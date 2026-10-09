import { isValidRoomCode } from "../../shared/roomCode";
import type { ClientMessage, IceCandidatePayload, ServerMessage, SignalPayload } from "../../shared/types/signaling";

const MAX_SDP_LENGTH = 32 * 1024;
const MAX_SIGNALING_MESSAGE_BYTES = 64 * 1024;
const MAX_CANDIDATE_LENGTH = 4096;
const MAX_PEERS_PER_ROOM = 2;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;

interface Env {
  ROOMS: DurableObjectNamespace;
  ALLOWED_ORIGINS?: string;
}

interface PeerAttachment {
  peerId: string;
  roomId: string | null;
  createdAt: number;
}

/**
 * Sini Sana signaling Worker. It only negotiates WebRTC connections (SDP
 * offer/answer and ICE candidates) and never relays the actual text or files
 * that peers exchange over their data channel.
 *
 * Every WebSocket is forwarded to a single Durable Object that keeps the room
 * registry in memory, mirroring the Node server.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }
    if (!(request.headers.get("Upgrade") ?? "").toLowerCase().includes("websocket")) {
      return new Response("Not found", { status: 404 });
    }
    if (!originAllowed(request.headers.get("Origin"), env.ALLOWED_ORIGINS)) {
      return new Response("Origin not allowed", { status: 403 });
    }
    const id = env.ROOMS.idFromName("rooms");
    return env.ROOMS.get(id).fetch(request);
  },
};

export class RoomDirectory {
  constructor(private readonly ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (!(request.headers.get("Upgrade") ?? "").toLowerCase().includes("websocket")) {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    setAttachment(server, { peerId: crypto.randomUUID(), roomId: null, createdAt: 0 });
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== "string") {
      safeClose(socket, 1003, "Binary messages are not supported");
      return;
    }
    this.handleRaw(socket, message);
  }

  webSocketClose(socket: WebSocket): void {
    this.cleanupSocket(socket);
  }

  webSocketError(socket: WebSocket): void {
    this.cleanupSocket(socket);
  }

  private handleRaw(socket: WebSocket, raw: string): void {
    if (raw.length > MAX_SIGNALING_MESSAGE_BYTES) {
      send(socket, errorResponse("bad-message", "Message too large."));
      safeClose(socket, 1009, "Message too large");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      send(socket, errorResponse("bad-message", "Invalid message."));
      return;
    }

    const message = parseClientMessage(parsed);
    if (!message) {
      send(socket, errorResponse("bad-message", "Invalid message."));
      return;
    }

    switch (message.type) {
      case "create-room": {
        const roomId = message.roomId.trim().toUpperCase();
        if (!isValidRoomCode(roomId)) {
          send(socket, errorResponse("invalid-room-id", "That room code isn't valid."));
          return;
        }
        this.cleanupSocket(socket);
        if (this.activePeers(roomId).length > 0) {
          send(socket, errorResponse("room-id-taken", "Room code already in use, try again."));
          return;
        }
        const peerId = getAttachment(socket)?.peerId ?? crypto.randomUUID();
        setAttachment(socket, { peerId, roomId, createdAt: Date.now() });
        send(socket, { type: "room-created", roomId });
        return;
      }

      case "join-room": {
        const roomId = message.roomId.trim().toUpperCase();
        if (!isValidRoomCode(roomId)) {
          send(socket, errorResponse("invalid-room-id", "That room code isn't valid."));
          return;
        }
        const active = this.activePeers(roomId);
        const others = active.filter((peer) => peer.socket !== socket);
        if (active.length === 0) {
          send(socket, errorResponse("room-not-found", "Room not found. It may have expired."));
          return;
        }
        if (others.length >= MAX_PEERS_PER_ROOM) {
          send(socket, errorResponse("room-full", "That room already has two devices."));
          return;
        }
        const existing = getAttachment(socket);
        if (existing?.roomId && existing.roomId !== roomId) {
          this.cleanupSocket(socket);
        }
        const roomCreatedAt = active[0]?.attachment.createdAt ?? Date.now();
        const peerId = existing?.peerId ?? crypto.randomUUID();
        setAttachment(socket, { peerId, roomId, createdAt: roomCreatedAt });
        for (const peer of this.peersForRoom(roomId)) {
          if (peer.socket !== socket) send(peer.socket, { type: "peer-joined" });
        }
        send(socket, { type: "room-joined", roomId });
        return;
      }

      case "leave-room": {
        this.cleanupSocket(socket);
        return;
      }

      case "signal": {
        const attachment = getAttachment(socket);
        if (!attachment?.roomId) {
          send(socket, errorResponse("bad-message", "You're not in a room."));
          return;
        }
        for (const peer of this.peersForRoom(attachment.roomId)) {
          if (peer.socket !== socket) {
            send(peer.socket, { type: "signal", from: attachment.peerId, data: message.data });
          }
        }
        return;
      }
    }
  }

  private peersForRoom(roomId: string): Array<{ socket: WebSocket; attachment: PeerAttachment }> {
    const peers: Array<{ socket: WebSocket; attachment: PeerAttachment }> = [];
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = getAttachment(socket);
      if (attachment?.roomId === roomId) peers.push({ socket, attachment });
    }
    return peers;
  }

  private activePeers(roomId: string): Array<{ socket: WebSocket; attachment: PeerAttachment }> {
    const now = Date.now();
    const active: Array<{ socket: WebSocket; attachment: PeerAttachment }> = [];
    for (const peer of this.peersForRoom(roomId)) {
      if (now - peer.attachment.createdAt > ROOM_TTL_MS) {
        safeClose(peer.socket, 1000, "Room expired");
      } else {
        active.push(peer);
      }
    }
    return active;
  }

  private cleanupSocket(socket: WebSocket): void {
    const attachment = getAttachment(socket);
    if (!attachment?.roomId) return;
    const roomId = attachment.roomId;
    setAttachment(socket, { ...attachment, roomId: null });
    for (const peer of this.peersForRoom(roomId)) {
      if (peer.socket !== socket) send(peer.socket, { type: "peer-left" });
    }
  }
}

function getAttachment(socket: WebSocket): PeerAttachment | null {
  try {
    const attachment = socket.deserializeAttachment() as PeerAttachment | null;
    return attachment ?? null;
  } catch {
    return null;
  }
}

function setAttachment(socket: WebSocket, attachment: PeerAttachment): void {
  try {
    socket.serializeAttachment(attachment);
  } catch {
    // The socket may already be closing; nothing to do.
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // The socket may already be closed; nothing to do.
  }
}

function safeClose(socket: WebSocket, code = 1000, reason = ""): void {
  try {
    socket.close(code, reason);
  } catch {
    // Ignore sockets that are already closed.
  }
}

function originAllowed(origin: string | null, raw: string | undefined): boolean {
  const allowed = parseOrigins(raw);
  if (allowed.length === 0) return true;
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  return allowed.includes(host);
}

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSdp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SDP_LENGTH;
}

function isCandidatePayload(value: unknown): value is IceCandidatePayload {
  if (!isRecord(value)) return false;
  if (
    typeof value.candidate !== "string" ||
    value.candidate.length === 0 ||
    value.candidate.length > MAX_CANDIDATE_LENGTH
  ) {
    return false;
  }
  const mid = value.sdpMid;
  if (mid !== undefined && mid !== null && typeof mid !== "string") return false;
  const index = value.sdpMLineIndex;
  if (index !== undefined && index !== null && (typeof index !== "number" || !Number.isInteger(index))) {
    return false;
  }
  return true;
}

function isSignalPayload(value: unknown): value is SignalPayload {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case "offer":
    case "answer":
      return isSdp(value.sdp);
    case "ice-candidate":
      return isCandidatePayload(value.candidate);
    case "end-session":
      return true;
    default:
      return false;
  }
}

function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case "create-room":
      if (typeof raw.roomId !== "string" || raw.roomId.length === 0) return null;
      return { type: "create-room", roomId: raw.roomId };
    case "join-room":
      if (typeof raw.roomId !== "string" || raw.roomId.length === 0) return null;
      return { type: "join-room", roomId: raw.roomId };
    case "leave-room":
      return { type: "leave-room" };
    case "signal":
      if (!isSignalPayload(raw.data)) return null;
      return { type: "signal", data: raw.data };
    default:
      return null;
  }
}

function errorResponse(
  code: "room-id-taken" | "room-not-found" | "room-full" | "bad-message" | "invalid-room-id",
  message: string,
): ServerMessage {
  return { type: "error", code, message };
}
