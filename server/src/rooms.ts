import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { isValidRoomCode } from "../../shared/roomCode.js";

export const MAX_PEERS_PER_ROOM = 2;

export interface RoomPeer {
  id: string;
  socket: WebSocket;
}

export interface Room {
  id: string;
  createdAt: number;
  lastActivity: number;
  peers: RoomPeer[];
}

export type CreateRoomResult = { ok: true; room: Room } | { ok: false; code: "invalid-room-id" | "room-id-taken" };

export type JoinRoomResult =
  | { ok: true; room: Room; peer: RoomPeer }
  | { ok: false; code: "invalid-room-id" | "room-not-found" | "room-full" };

/** In-memory room registry. No persistence: rooms vanish on restart. */
export class RoomStore {
  private readonly rooms = new Map<string, Room>();

  constructor(private readonly ttlMs: number) {}

  get size(): number {
    return this.rooms.size;
  }

  stats(): { rooms: number } {
    return { rooms: this.rooms.size };
  }

  create(roomId: string, socket: WebSocket): CreateRoomResult {
    if (!isValidRoomCode(roomId)) return { ok: false, code: "invalid-room-id" };
    if (this.rooms.has(roomId)) return { ok: false, code: "room-id-taken" };
    const peer = { id: randomUUID(), socket };
    this.rooms.set(roomId, {
      id: roomId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      peers: [peer],
    });
    const room = this.rooms.get(roomId);
    if (room) return { ok: true, room };
    return { ok: false, code: "room-id-taken" };
  }

  join(roomId: string, socket: WebSocket): JoinRoomResult {
    if (!isValidRoomCode(roomId)) return { ok: false, code: "invalid-room-id" };
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, code: "room-not-found" };
    if (room.peers.length >= MAX_PEERS_PER_ROOM) return { ok: false, code: "room-full" };
    const peer = { id: randomUUID(), socket };
    room.peers.push(peer);
    room.lastActivity = Date.now();
    return { ok: true, room, peer };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  roomForSocket(socket: WebSocket): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.peers.some((peer) => peer.socket === socket)) return room;
    }
    return undefined;
  }

  peerIdForSocket(socket: WebSocket): string | null {
    const room = this.roomForSocket(socket);
    const peer = room?.peers.find((p) => p.socket === socket);
    return peer?.id ?? null;
  }

  removeRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  /** Removes a socket from whatever room it is in. Returns the room if it still has peers. */
  removeSocketFromRoom(socket: WebSocket): { room: Room | undefined; remaining: RoomPeer[] } | null {
    const room = this.roomForSocket(socket);
    if (!room) return null;
    room.peers = room.peers.filter((peer) => peer.socket !== socket);
    room.lastActivity = Date.now();
    if (room.peers.length === 0) {
      this.rooms.delete(room.id);
      return { room: undefined, remaining: [] };
    }
    return { room, remaining: room.peers };
  }

  /** Removes expired and empty rooms. Returns how many rooms were removed. */
  sweep(now: number = Date.now()): number {
    let removed = 0;
    for (const [id, room] of this.rooms) {
      if (room.peers.length === 0 || now - room.createdAt > this.ttlMs) {
        this.rooms.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}