import { describe, expect, it } from "vitest";
import {
  encodeServerMessage,
  errorResponse,
  isFatalMessageError,
  isValidRoomId,
  MAX_CANDIDATE_LENGTH,
  MAX_SDP_LENGTH,
  parseClientMessage,
} from "./signaling.js";

describe("parseClientMessage", () => {
  it("accepts valid messages", () => {
    expect(parseClientMessage({ type: "create-room", roomId: "ABC123" })).toEqual({
      type: "create-room",
      roomId: "ABC123",
    });
    expect(parseClientMessage({ type: "join-room", roomId: "ABC123" })).toEqual({
      type: "join-room",
      roomId: "ABC123",
    });
    expect(parseClientMessage({ type: "leave-room" })).toEqual({ type: "leave-room" });
  });

  it("accepts valid signal payloads", () => {
    expect(parseClientMessage({ type: "signal", data: { kind: "offer", sdp: "a-sdp" } })).toEqual({
      type: "signal",
      data: { kind: "offer", sdp: "a-sdp" },
    });
    expect(parseClientMessage({ type: "signal", data: { kind: "answer", sdp: "b-sdp" } })).toEqual({
      type: "signal",
      data: { kind: "answer", sdp: "b-sdp" },
    });
    expect(
      parseClientMessage({
        type: "signal",
        data: {
          kind: "ice-candidate",
          candidate: {
            candidate: "candidate:1 1 udp 100 x 9 1 typ host",
            sdpMid: "0",
            sdpMLineIndex: 0,
          },
        },
      }),
    ).toEqual({
      type: "signal",
      data: {
        kind: "ice-candidate",
        candidate: {
          candidate: "candidate:1 1 udp 100 x 9 1 typ host",
          sdpMid: "0",
          sdpMLineIndex: 0,
        },
      },
    });
    expect(parseClientMessage({ type: "signal", data: { kind: "end-session" } })).toEqual({
      type: "signal",
      data: { kind: "end-session" },
    });
  });

  it("rejects malformed messages", () => {
    expect(parseClientMessage(null)).toBeNull();
    expect(parseClientMessage("hi")).toBeNull();
    expect(parseClientMessage([])).toBeNull();
    expect(parseClientMessage({})).toBeNull();
    expect(parseClientMessage({ type: "nope" })).toBeNull();
    expect(parseClientMessage({ type: "create-room" })).toBeNull();
    expect(parseClientMessage({ type: "create-room", roomId: "" })).toBeNull();
  });

  it("rejects malformed signal payloads", () => {
    expect(parseClientMessage({ type: "signal", data: { kind: "offer" } })).toBeNull();
    expect(parseClientMessage({ type: "signal", data: { kind: "offer", sdp: "" } })).toBeNull();
    expect(parseClientMessage({ type: "signal", data: { kind: "answer", sdp: "x".repeat(MAX_SDP_LENGTH + 1) } })).toBeNull();
    expect(
      parseClientMessage({
        type: "signal",
        data: { kind: "ice-candidate", candidate: "not-an-object" },
      }),
    ).toBeNull();
    expect(
      parseClientMessage({
        type: "signal",
        data: { kind: "ice-candidate", candidate: { candidate: "", sdpMid: null, sdpMLineIndex: null } },
      }),
    ).toBeNull();
    expect(
      parseClientMessage({
        type: "signal",
        data: { kind: "ice-candidate", candidate: { candidate: "c".repeat(MAX_CANDIDATE_LENGTH + 1) } },
      }),
    ).toBeNull();
  });
});

describe("helpers", () => {
  it("validates room ids against the shared code rules", () => {
    expect(isValidRoomId("ABC234")).toBe(true);
    expect(isValidRoomId("ABC23O")).toBe(false);
    expect(isValidRoomId(123)).toBe(false);
  });

  it("fails oversized messages at the transport boundary", () => {
    expect(isFatalMessageError("x".repeat(64 * 1024 + 1))).toBe(true);
    expect(isFatalMessageError("hi")).toBe(false);
  });

  it("round-trips encoded server messages", () => {
    expect(JSON.parse(encodeServerMessage({ type: "peer-joined" }))).toEqual({ type: "peer-joined" });
    expect(JSON.parse(encodeServerMessage(errorResponse("room-full", "full")))).toEqual({
      type: "error",
      code: "room-full",
      message: "full",
    });
  });
});