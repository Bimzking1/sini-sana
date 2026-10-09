export { ROOM_CODE_LENGTH } from "../../shared/roomCode";

/**
 * Lifecycle phase of a room session. The UI derives a human readable
 * status label from this value.
 */
export type RoomPhase =
  | "idle"
  | "creating"
  | "waiting"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed";