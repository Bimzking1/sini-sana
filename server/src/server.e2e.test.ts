import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { get as httpGet } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createSignalingServer, type SignalingServer } from "./index.js";
import type { ServerMessage } from "../../shared/types/signaling.js";

class TestClient {
  readonly messages: ServerMessage[] = [];
  private readonly waiters: Array<{
    pred: (message: ServerMessage) => boolean;
    resolve: (message: ServerMessage) => void;
  }> = [];

  constructor(readonly socket: WebSocket) {
    socket.on("message", (data) => {
      const message = JSON.parse((data as Buffer).toString()) as ServerMessage;
      this.messages.push(message);
      for (let i = this.waiters.length - 1; i >= 0; i -= 1) {
        if (this.waiters[i]?.pred(message)) {
          const waiter = this.waiters.splice(i, 1)[0];
          waiter?.resolve(message);
        }
      }
    });
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  waitFor(pred: (message: ServerMessage) => boolean, timeoutMs = 2000): Promise<ServerMessage> {
    const existing = this.messages.find(pred);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for a message.")), timeoutMs);
      this.waiters.push({
        pred,
        resolve: (message) => {
          clearTimeout(timer);
          resolve(message);
        },
      });
    });
  }

  close(): void {
    this.socket.close();
  }
}

function connect(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}`);
    const client = new TestClient(socket);
    const timer = setTimeout(() => reject(new Error("Timed out connecting.")), 2000);
    socket.once("open", () => {
      clearTimeout(timer);
      resolve(client);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Failed to connect."));
    });
  });
}

describe("signaling server end-to-end", () => {
  let server: SignalingServer;
  let port: number;

  beforeAll(async () => {
    server = createSignalingServer({ heartbeatMs: 60_000, sweepIntervalMs: 60_000 });
    await new Promise<void>((resolve) => {
      server.httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    port = (server.httpServer.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await server.close();
  });

  it("serves a health check", async () => {
    const { statusCode, body } = await new Promise<{ statusCode: number; body: string }>(
      (resolve, reject) => {
        httpGet(`http://127.0.0.1:${port}/healthz`, (res) => {
          let body = "";
          res.on("data", (chunk) => {
            body += chunk.toString();
          });
          res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body }));
        }).on("error", reject);
      },
    );
    expect(statusCode).toBe(200);
    expect(JSON.parse(body)).toMatchObject({ ok: true });
  });

  it("creates a room, joins it, and relays signaling end-to-end", async () => {
    const a = await connect(port);
    const b = await connect(port);

    a.send({ type: "create-room", roomId: "ABCDEF" });
    expect(await a.waitFor((m) => m.type === "room-created")).toEqual({
      type: "room-created",
      roomId: "ABCDEF",
    });

    b.send({ type: "join-room", roomId: "ABCDEF" });
    expect(await b.waitFor((m) => m.type === "room-joined")).toEqual({
      type: "room-joined",
      roomId: "ABCDEF",
    });
    expect(await a.waitFor((m) => m.type === "peer-joined")).toEqual({ type: "peer-joined" });

    a.send({ type: "signal", data: { kind: "offer", sdp: "test-sdp" } });
    const relayed = await b.waitFor((m) => m.type === "signal");
    expect(relayed.type).toBe("signal");
    if (relayed.type === "signal") {
      expect(relayed.data).toEqual({ kind: "offer", sdp: "test-sdp" });
      expect(typeof relayed.from).toBe("string");
    }

    a.close();
    await b.waitFor((m) => m.type === "peer-left");
    b.close();
  });

  it("rejects join for missing and invalid rooms", async () => {
    const missing = await connect(port);
    missing.send({ type: "join-room", roomId: "ZZZZ99" });
    expect(await missing.waitFor((m) => m.type === "error")).toMatchObject({
      code: "room-not-found",
    });

    const invalid = await connect(port);
    invalid.send({ type: "create-room", roomId: "??????" });
    expect(await invalid.waitFor((m) => m.type === "error")).toMatchObject({
      code: "invalid-room-id",
    });

    invalid.close();
    missing.close();
  });

  it("enforces a two-device room and rejects duplicate creation", async () => {
    const a = await connect(port);
    const b = await connect(port);
    const c = await connect(port);
    const d = await connect(port);

    a.send({ type: "create-room", roomId: "K7MXP2" });
    await a.waitFor((m) => m.type === "room-created");
    b.send({ type: "join-room", roomId: "K7MXP2" });
    await b.waitFor((m) => m.type === "room-joined");

    c.send({ type: "join-room", roomId: "K7MXP2" });
    expect(await c.waitFor((m) => m.type === "error")).toMatchObject({ code: "room-full" });

    d.send({ type: "create-room", roomId: "K7MXP2" });
    expect(await d.waitFor((m) => m.type === "error")).toMatchObject({ code: "room-id-taken" });

    a.close();
    b.close();
    c.close();
    d.close();
  });

  it("rejects garbage and out-of-room signals", async () => {
    const client = await connect(port);
    client.send("not json");
    expect(await client.waitFor((m) => m.type === "error")).toMatchObject({ code: "bad-message" });

    client.send({ type: "nope" });
    expect(await client.waitFor((m) => m.type === "error")).toMatchObject({ code: "bad-message" });

    client.send({ type: "signal", data: { kind: "offer", sdp: "x" } });
    expect(await client.waitFor((m) => m.type === "error" && m.message.includes("not in a room"))).toMatchObject({
      code: "bad-message",
    });
    client.close();
  });

  it("sends peer-left when one side leaves", async () => {
    const a = await connect(port);
    const b = await connect(port);
    a.send({ type: "create-room", roomId: "J8XQ4Z" });
    await a.waitFor((m) => m.type === "room-created");
    b.send({ type: "join-room", roomId: "J8XQ4Z" });
    await b.waitFor((m) => m.type === "room-joined");

    b.send({ type: "leave-room" });
    expect(await a.waitFor((m) => m.type === "peer-left")).toEqual({ type: "peer-left" });
    a.close();
  });
});