import { describe, expect, it } from "vitest";
import { RoomStore, MAX_PEERS_PER_ROOM } from "./rooms.js";
import type { WebSocket } from "ws";

let socketSeq = 0;
function fakeSocket(): WebSocket {
  socketSeq += 1;
  return { id: `socket-${socketSeq}` } as unknown as WebSocket;
}

describe("RoomStore", () => {
  it("creates rooms for valid codes and rejects invalid ones", () => {
    const store = new RoomStore(1000);
    const socket = fakeSocket();
    expect(store.create("ABC234", socket).ok).toBe(true);
    expect(store.create("not-a-code", socket).ok).toBe(false);
    expect(store.create("ABC234", fakeSocket()).ok).toBe(false);
    expect(store.size).toBe(1);
  });

  it("joins rooms and enforces a two-peer limit", () => {
    const store = new RoomStore(1000);
    const host = fakeSocket();
    store.create("ABC234", host);
    expect(store.join("ABC234", fakeSocket()).ok).toBe(true);
    const third = store.join("ABC234", fakeSocket());
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.code).toBe("room-full");
    expect(store.join("ZZZZ99", fakeSocket()).ok).toBe(false);
  });

  it("tracks peers by socket", () => {
    const store = new RoomStore(1000);
    const host = fakeSocket();
    const joiner = fakeSocket();
    store.create("ABC234", host);
    const joined = store.join("ABC234", joiner);
    if (!joined.ok) throw new Error("join should succeed");
    expect(joined.peer.id).toBeTruthy();
    expect(store.peerIdForSocket(host)).toBe(store.getRoom("ABC234")?.peers[0]?.id);
    expect(store.peerIdForSocket(joiner)).toBe(joined.peer.id);
    expect(store.peerIdForSocket(fakeSocket())).toBeNull();
  });

  it("removes sockets and deletes empty rooms", () => {
    const store = new RoomStore(1000);
    const host = fakeSocket();
    const joiner = fakeSocket();
    store.create("ABC234", host);
    store.join("ABC234", joiner);

    const firstLeave = store.removeSocketFromRoom(host);
    expect(firstLeave?.remaining).toHaveLength(1);
    expect(store.getRoom("ABC234")?.peers.map((p) => p.id)).toEqual([joiner ? store.peerIdForSocket(joiner) : ""]);

    const lastLeave = store.removeSocketFromRoom(joiner);
    expect(lastLeave?.remaining).toEqual([]);
    expect(store.getRoom("ABC234")).toBeUndefined();
  });

  it("sweeps expired and empty rooms", () => {
    const store = new RoomStore(1000);
    const now = Date.now();
    store.create("ABC234", fakeSocket());
    store.create("DEF456", fakeSocket());
    expect(store.sweep(now)).toBe(0);
    expect(store.sweep(now + 1001)).toBe(2);
    expect(store.size).toBe(0);
  });

  it("publishes a sane peer limit", () => {
    expect(MAX_PEERS_PER_ROOM).toBe(2);
  });
});