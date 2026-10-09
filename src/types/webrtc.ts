export type WebRtcStatus = "connecting" | "connected" | "disconnected" | "failed";

export interface IceServersConfig {
  iceServers: RTCIceServer[];
}

/** Events the peer connection surfaces to the UI layer. */
export interface PeerConnectionCallbacks {
  onIceCandidate: (candidate: RTCIceCandidate | null) => void;
  onStatusChange: (status: WebRtcStatus) => void;
  onDataChannel: (channel: RTCDataChannel) => void;
}

/** Human readable explanation of why an RTC connection failed. */
export function reasonForConnectionFailure(state: RTCPeerConnectionState): string {
  switch (state) {
    case "failed":
      return "Couldn't establish a connection between the two devices.";
    case "closed":
      return "The connection was closed.";
    case "disconnected":
      return "The connection was lost.";
    default:
      return "The connection was interrupted.";
  }
}