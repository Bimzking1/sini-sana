/** Payload of an ICE candidate as relayed through signaling. */
export interface IceCandidatePayload {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

/** A WebRTC negotiation message sent over the signaling channel. */
export type SignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice-candidate"; candidate: IceCandidatePayload }
  | { kind: "end-session" };

export type ClientMessage =
  | { type: "create-room"; roomId: string }
  | { type: "join-room"; roomId: string }
  | { type: "leave-room" }
  | { type: "signal"; data: SignalPayload };

export type SignalingErrorCode =
  | "room-id-taken"
  | "room-not-found"
  | "room-full"
  | "bad-message"
  | "invalid-room-id";

export type ServerMessage =
  | { type: "room-created"; roomId: string }
  | { type: "room-joined"; roomId: string }
  | { type: "peer-joined" }
  | { type: "peer-left" }
  | { type: "signal"; from: string; data: SignalPayload }
  | { type: "error"; code: SignalingErrorCode; message: string };