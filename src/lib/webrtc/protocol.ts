import type {
  ChannelData,
  ControlMessage,
  FileAbortMessage,
  FileEndMessage,
  FileStartMessage,
  TextMessage,
} from "../../types/transfer";
import {
  MAX_FILE_NAME_LENGTH,
  MAX_FILE_SIZE,
  MAX_MIME_TYPE_LENGTH,
  MAX_TRANSFER_ID_LENGTH,
} from "../../types/transfer";

/** Binary frame marker: only file chunks travel as raw binary. */
export const FRAME_TYPE_FILE_CHUNK = 1;

/** Maximum acceptable payload inside a single file chunk frame. */
export const MAX_CHUNK_PAYLOAD_SIZE = 64 * 1024;

export interface FileChunkFrame {
  transferId: string;
  sequence: number;
  payload: ArrayBuffer;
}

export function createTextMessage(content: string): TextMessage {
  return {
    type: "text",
    id: crypto.randomUUID(),
    content,
    timestamp: Date.now(),
  };
}

export function createTransferId(): string {
  return crypto.randomUUID();
}

export function parseControlMessage(raw: string): ControlMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return validateControlMessage(parsed);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" && value.length > 0 && value.length <= maxLength
  );
}

export function isValidTransferId(id: unknown): id is string {
  return isNonEmptyString(id, MAX_TRANSFER_ID_LENGTH);
}

function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_FILE_NAME_LENGTH;
}

function isValidMimeType(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_MIME_TYPE_LENGTH;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateControlMessage(value: unknown): ControlMessage | null {
  if (!isRecord(value)) return null;

  switch (value.type) {
    case "text":
      if (!isNonEmptyString(value.content, 512_000)) return null;
      if (!isValidTransferId(value.id)) return null;
      if (!isValidTimestamp(value.timestamp)) return null;
      return {
        type: "text",
        id: value.id,
        content: value.content,
        timestamp: value.timestamp,
      };

    case "file-start": {
      if (!isValidTransferId(value.id)) return null;
      if (!isValidName(value.name)) return null;
      if (!isValidMimeType(value.mimeType)) return null;
      const size = value.size;
      if (typeof size !== "number" || !Number.isFinite(size) || size < 0) {
        return null;
      }
      if (size > MAX_FILE_SIZE) return null;
      return {
        type: "file-start",
        id: value.id,
        name: value.name,
        mimeType: value.mimeType,
        size,
      };
    }

    case "file-end":
      if (!isValidTransferId(value.id)) return null;
      return { type: "file-end", id: value.id };

    case "file-abort": {
      if (!isValidTransferId(value.id)) return null;
      const reason = value.reason;
      if (reason !== undefined && typeof reason !== "string") return null;
      const message: FileAbortMessage = { type: "file-abort", id: value.id };
      if (typeof reason === "string" && reason.length > 0) message.reason = reason;
      return message;
    }

    default:
      return null;
  }
}

/**
 * Encodes a single file chunk as a compact binary frame:
 *
 *   [0]        uint8   frame type (1 = file chunk)
 *   [1]        uint8   transfer id byte length
 *   [2..]      utf8    transfer id
 *   [..]     uint32 BE  chunk sequence number
 *   remainder          chunk payload
 *
 * Keeping the frame binary (rather than JSON) avoids base64 overhead and
 * keeps the browser's DataChannel buffer efficient.
 */
export function encodeFileChunkFrame(
  transferId: string,
  sequence: number,
  payload: ArrayBuffer,
): ArrayBuffer {
  const idBytes = new TextEncoder().encode(transferId);
  if (idBytes.byteLength > 255) {
    throw new Error("Transfer id is too long for the chunk frame.");
  }
  const buffer = new ArrayBuffer(2 + idBytes.byteLength + 4 + payload.byteLength);
  const view = new DataView(buffer);
  view.setUint8(0, FRAME_TYPE_FILE_CHUNK);
  view.setUint8(1, idBytes.byteLength);
  new Uint8Array(buffer, 2, idBytes.byteLength).set(idBytes);
  const sequenceOffset = 2 + idBytes.byteLength;
  view.setUint32(sequenceOffset, sequence >>> 0);
  if (payload.byteLength > 0) {
    new Uint8Array(buffer, sequenceOffset + 4).set(new Uint8Array(payload));
  }
  return buffer;
}

export function decodeFileChunkFrame(buffer: ArrayBuffer): FileChunkFrame | null {
  if (buffer.byteLength < 7) return null;
  const view = new DataView(buffer);
  if (view.getUint8(0) !== FRAME_TYPE_FILE_CHUNK) return null;
  const idLength = view.getUint8(1);
  if (idLength === 0 || idLength > MAX_TRANSFER_ID_LENGTH) return null;
  const headerLength = 2 + idLength + 4;
  if (buffer.byteLength < headerLength) return null;
  const idBytes = new Uint8Array(buffer, 2, idLength);
  let transferId: string;
  try {
    transferId = new TextDecoder().decode(idBytes);
  } catch {
    return null;
  }
  if (!isValidTransferId(transferId)) return null;
  const sequence = view.getUint32(2 + idLength);
  const payloadLength = buffer.byteLength - headerLength;
  if (payloadLength > MAX_CHUNK_PAYLOAD_SIZE) return null;
  const payload = buffer.slice(headerLength);
  return { transferId, sequence, payload };
}

export function isControlChannelData(data: ChannelData): data is string {
  return typeof data === "string";
}

export function isBinaryChannelData(data: ChannelData): data is ArrayBuffer {
  return typeof data === "string" ? false : data instanceof ArrayBuffer;
}

export function isTextMessage(message: ControlMessage): message is TextMessage {
  return message.type === "text";
}

export function isFileStartMessage(message: ControlMessage): message is FileStartMessage {
  return message.type === "file-start";
}

export function isFileEndMessage(message: ControlMessage): message is FileEndMessage {
  return message.type === "file-end";
}

export function isFileAbortMessage(message: ControlMessage): message is FileAbortMessage {
  return message.type === "file-abort";
}