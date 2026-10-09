import { describe, expect, it } from "vitest";
import {
  MAX_CHUNK_PAYLOAD_SIZE,
  decodeFileChunkFrame,
  encodeFileChunkFrame,
  parseControlMessage,
  validateControlMessage,
  FRAME_TYPE_FILE_CHUNK,
  createTextMessage,
  createTransferId,
} from "./protocol";
import { MAX_FILE_SIZE, MAX_FILE_NAME_LENGTH, MAX_TRANSFER_ID_LENGTH } from "../../types/transfer";

describe("text messages", () => {
  it("creates a valid text message", () => {
    const message = createTextMessage("hello");
    expect(message.type).toBe("text");
    expect(message.content).toBe("hello");
    expect(message.id).toBeTruthy();
    expect(message.timestamp).toBeGreaterThan(0);
  });

  it("creates unique transfer ids", () => {
    expect(createTransferId()).not.toBe(createTransferId());
  });
});

describe("control message validation", () => {
  it("accepts valid control messages", () => {
    expect(validateControlMessage({ type: "text", id: "id-1", content: "hi", timestamp: 1 })).toEqual({
      type: "text",
      id: "id-1",
      content: "hi",
      timestamp: 1,
    });
    expect(
      validateControlMessage({ type: "file-start", id: "id-1", name: "a.txt", mimeType: "text/plain", size: 10 }),
    ).toEqual({ type: "file-start", id: "id-1", name: "a.txt", mimeType: "text/plain", size: 10 });
    expect(validateControlMessage({ type: "file-end", id: "id-1" })).toEqual({ type: "file-end", id: "id-1" });
    expect(validateControlMessage({ type: "file-abort", id: "id-1", reason: "x" })).toEqual({
      type: "file-abort",
      id: "id-1",
      reason: "x",
    });
  });

  it("rejects malformed messages", () => {
    expect(validateControlMessage(null)).toBeNull();
    expect(validateControlMessage({ type: "nope" })).toBeNull();
    expect(validateControlMessage([])).toBeNull();
    expect(validateControlMessage({ type: "text", content: "hi", timestamp: 1 })).toBeNull();
    expect(validateControlMessage({ type: "text", id: "", content: "hi", timestamp: 1 })).toBeNull();
    expect(
      validateControlMessage({ type: "text", id: "x".repeat(MAX_TRANSFER_ID_LENGTH + 1), content: "hi", timestamp: 1 }),
    ).toBeNull();
    expect(validateControlMessage({ type: "text", id: "id", content: "", timestamp: 1 })).toBeNull();
    expect(
      validateControlMessage({ type: "file-start", id: "id", name: "a", mimeType: "m", size: MAX_FILE_SIZE + 1 }),
    ).toBeNull();
    expect(validateControlMessage({ type: "file-start", id: "id", name: "a", mimeType: "m", size: -1 })).toBeNull();
    expect(
      validateControlMessage({ type: "file-start", id: "id", name: "x".repeat(MAX_FILE_NAME_LENGTH + 1), mimeType: "m", size: 1 }),
    ).toBeNull();
  });

  it("parses json strings", () => {
    expect(parseControlMessage('{"type":"file-end","id":"abc"}')).toEqual({ type: "file-end", id: "abc" });
    expect(parseControlMessage("not json")).toBeNull();
    expect(parseControlMessage('{"type":"unknown"}')).toBeNull();
  });
});

describe("binary file chunk frames", () => {
  it("round-trips a chunk", () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const frame = encodeFileChunkFrame("t-1", 7, payload);
    const decoded = decodeFileChunkFrame(frame);
    expect(decoded).not.toBeNull();
    expect(decoded?.transferId).toBe("t-1");
    expect(decoded?.sequence).toBe(7);
    expect(new Uint8Array(decoded?.payload ?? new ArrayBuffer(0))).toEqual(new Uint8Array(payload));
  });

  it("round-trips a large payload", () => {
    const payload = new Uint8Array(MAX_CHUNK_PAYLOAD_SIZE).fill(3).buffer;
    const decoded = decodeFileChunkFrame(encodeFileChunkFrame("big", 0, payload));
    expect(decoded?.sequence).toBe(0);
    expect(decoded?.payload.byteLength).toBe(MAX_CHUNK_PAYLOAD_SIZE);
  });

  it("rejects truncated or malformed buffers", () => {
    expect(decodeFileChunkFrame(new ArrayBuffer(0))).toBeNull();
    expect(decodeFileChunkFrame(new ArrayBuffer(6))).toBeNull();

    const payload = new Uint8Array([9]).buffer;
    const withWrongType = encodeFileChunkFrame("id", 0, payload);
    new Uint8Array(withWrongType)[0] = FRAME_TYPE_FILE_CHUNK + 1;
    expect(decodeFileChunkFrame(withWrongType)).toBeNull();

    const emptyId = new Uint8Array([FRAME_TYPE_FILE_CHUNK, 0, 0, 0, 0, 0, 1]);
    expect(decodeFileChunkFrame(emptyId.buffer)).toBeNull();
  });

  it("rejects oversized payloads", () => {
    const payload = new Uint8Array(MAX_CHUNK_PAYLOAD_SIZE + 1).buffer;
    expect(decodeFileChunkFrame(encodeFileChunkFrame("id", 0, payload))).toBeNull();
  });
});