import { createServer, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import process from "node:process";
import WebSocket, { WebSocketServer } from "ws";
import { RoomStore } from "./rooms.js";
import type { Room } from "./rooms.js";
import {
  encodeServerMessage,
  errorResponse,
  isFatalMessageError,
  MAX_SIGNALING_MESSAGE_BYTES,
  parseClientMessage,
} from "./signaling.js";
import type { ServerMessage } from "../../shared/types/signaling.js";
import { isValidRoomCode } from "../../shared/roomCode.js";

export interface SignalingServerOptions {
  roomTtlMs?: number;
  heartbeatMs?: number;
  sweepIntervalMs?: number;
  allowedOrigins?: string[];
}

export interface SignalingServer {
  readonly httpServer: Server;
  readonly store: RoomStore;
  close: () => Promise<void>;
}

const DEFAULT_ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const DEFAULT_HEARTBEAT_MS = 30_000;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

const ORIGIN_NOT_ALLOWED = "Origin not allowed";

/**
 * Creates the Sini Sana signaling server. The server only negotiates WebRTC
 * connections (SDP offer/answer and ICE candidates); it never relays the
 * actual text or files that peers exchange over their data channel.
 */
export function createSignalingServer(options: SignalingServerOptions = {}): SignalingServer {
  const roomTtlMs = options.roomTtlMs ?? DEFAULT_ROOM_TTL_MS;
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
  const allowedOrigins = options.allowedOrigins ?? [];

  const store = new RoomStore(roomTtlMs);

  const httpServer = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(JSON.stringify({ ok: true, rooms: store.size }));
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  });

  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: MAX_SIGNALING_MESSAGE_BYTES,
  });

  const alive = new WeakMap<WebSocket, boolean>();

  const originAllowed = (origin: string | undefined): boolean => {
    if (allowedOrigins.length === 0) return true;
    if (!origin) return true;
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return false;
    }
    return allowedOrigins.some((allowed) => allowed.trim() === host);
  };

  function send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(encodeServerMessage(message));
    }
  }

  function notifyRemainingPeers(remaining: Room["peers"]): void {
    for (const peer of remaining) {
      if (peer.socket.readyState === WebSocket.OPEN) {
        send(peer.socket, { type: "peer-left" });
      }
    }
  }

  function cleanupSocketFromRoom(socket: WebSocket): void {
    const result = store.removeSocketFromRoom(socket);
    if (result?.room && result.remaining.length > 0) {
      notifyRemainingPeers(result.remaining);
    }
  }

  function handleRaw(socket: WebSocket, raw: string): void {
    if (isFatalMessageError(raw)) {
      send(socket, errorResponse("bad-message", "Message too large."));
      socket.close(1009, "Message too large");
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
        cleanupSocketFromRoom(socket);
        const roomId = message.roomId.trim().toUpperCase();
        if (!isValidRoomCode(roomId)) {
          send(socket, errorResponse("invalid-room-id", "That room code isn't valid."));
          return;
        }
        const result = store.create(roomId, socket);
        if (result.ok) {
          send(socket, { type: "room-created", roomId });
        } else if (result.code === "room-id-taken") {
          send(socket, errorResponse("room-id-taken", "Room code already in use, try again."));
        } else {
          send(socket, errorResponse("invalid-room-id", "That room code isn't valid."));
        }
        return;
      }

      case "join-room": {
        const roomId = message.roomId.trim().toUpperCase();
        const result = store.join(roomId, socket);
        if (!result.ok) {
          send(socket, errorResponse(result.code, humanRoomError(result.code)));
          return;
        }
        for (const peer of result.room.peers) {
          if (peer.socket !== socket) send(peer.socket, { type: "peer-joined" });
        }
        send(socket, { type: "room-joined", roomId });
        return;
      }

      case "leave-room": {
        cleanupSocketFromRoom(socket);
        return;
      }

      case "signal": {
        const room = store.roomForSocket(socket);
        if (!room) {
          send(socket, errorResponse("bad-message", "You're not in a room."));
          return;
        }
        const from = store.peerIdForSocket(socket);
        for (const peer of room.peers) {
          if (peer.socket !== socket && peer.socket.readyState === WebSocket.OPEN) {
            peer.socket.send(
              encodeServerMessage({
                type: "signal",
                from: from ?? "",
                data: message.data,
              }),
            );
          }
        }
        return;
      }
    }
  }

  wss.on("connection", (socket, request) => {
    if (!originAllowed(request.headers.origin)) {
      socket.close(1008, ORIGIN_NOT_ALLOWED);
      return;
    }

    alive.set(socket, true);
    socket.on("pong", () => alive.set(socket, true));
    socket.on("error", () => {
      // The 'close' handler performs the actual cleanup.
    });

    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        socket.close(1003, "Binary messages are not supported");
        return;
      }
      handleRaw(socket, data.toString());
    });

    socket.on("close", () => {
      alive.delete(socket);
      cleanupSocketFromRoom(socket);
    });
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (alive.get(socket) === false) {
        socket.terminate();
        continue;
      }
      alive.set(socket, false);
      socket.ping();
    }
  }, heartbeatMs);

  const sweep = setInterval(() => {
    store.sweep();
  }, sweepIntervalMs);

  heartbeat.unref();
  sweep.unref();

  return {
    httpServer,
    store,
    close: async () => {
      clearInterval(heartbeat);
      clearInterval(sweep);
      for (const socket of wss.clients) {
        socket.terminate();
      }
      wss.close();
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
}

function humanRoomError(code: "invalid-room-id" | "room-not-found" | "room-full"): string {
  switch (code) {
    case "invalid-room-id":
      return "That room code isn't valid.";
    case "room-not-found":
      return "Room not found. It may have expired.";
    case "room-full":
      return "That room already has two devices.";
  }
}

function parseOrigins(env: string | undefined): string[] {
  if (!env) return [];
  return env
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const port = Number(process.env.PORT ?? "3001");
  const { httpServer } = createSignalingServer({
    allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS),
  });
  httpServer.listen(port, () => {
    console.log(`Sini Sana signaling server listening on http://localhost:${port}`);
    console.log("The server only negotiates WebRTC connections; it does not store or relay messages or files.");
  });
}