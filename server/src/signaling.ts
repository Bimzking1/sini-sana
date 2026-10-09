import type { ClientMessage, IceCandidatePayload, ServerMessage, SignalPayload } from "../../shared/types/signaling.js";
import { isValidRoomCode } from "../../shared/roomCode.js";

export const MAX_SDP_LENGTH = 32 * 1024;
export const MAX_SIGNALING_MESSAGE_BYTES = 64 * 1024;
export const MAX_CANDIDATE_LENGTH = 4096;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSdp(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_SDP_LENGTH;
}

function isCandidatePayload(value: unknown): value is IceCandidatePayload {
  if (!isRecord(value)) return false;
  if (typeof value.candidate !== "string" || value.candidate.length === 0 || value.candidate.length > MAX_CANDIDATE_LENGTH) {
    return false;
  }
  const mid = value.sdpMid;
  if (mid !== undefined && mid !== null && typeof mid !== "string") return false;
  const index = value.sdpMLineIndex;
  if (index !== undefined && index !== null && (typeof index !== "number" || !Number.isInteger(index))) return false;
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

/**
 * Parses and validates a raw signaling message from a client. Returns null
 * when the message cannot be trusted (malformed JSON, unknown type, invalid
 * payload). Messages are validated on the wire: the server never blindly
 * trusts client-provided metadata.
 */
export function parseClientMessage(raw: unknown): ClientMessage | null {
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

export function isValidRoomId(raw: unknown): raw is string {
  return typeof raw === "string" && isValidRoomCode(raw);
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

export function isFatalMessageError(raw: string): boolean {
  return raw.length > MAX_SIGNALING_MESSAGE_BYTES;
}

export type SignalingErrorResponse = Extract<ServerMessage, { type: "error" }>;

export function errorResponse(code: "room-id-taken" | "room-not-found" | "room-full" | "bad-message" | "invalid-room-id", message: string): SignalingErrorResponse {
  return { type: "error", code, message };
}