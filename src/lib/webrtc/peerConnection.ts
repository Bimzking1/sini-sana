import type { IceCandidatePayload } from "../../types/signaling";
import type { PeerConnectionCallbacks } from "../../types/webrtc";
import { isDebugEnabled, rtcDebug } from "../debug";
import { LOW_WATERMARK } from "./dataChannel";

export const DATA_CHANNEL_LABEL = "sinisana";

/** Creates a peer connection and wires up the callback surface. */
export function createPeerConnection(
  iceServers: RTCIceServer[],
  callbacks: PeerConnectionCallbacks,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 4,
  });

  pc.onicecandidate = (event): void => {
    if (isDebugEnabled()) rtcDebug("local candidate", event.candidate?.candidate ?? "(end)");
    callbacks.onIceCandidate(event.candidate);
  };

  pc.oniceconnectionstatechange = (): void => {
    if (isDebugEnabled()) rtcDebug("iceConnectionState ->", pc.iceConnectionState);
  };

  pc.onconnectionstatechange = (): void => {
    if (isDebugEnabled()) {
      rtcDebug("connectionState ->", pc.connectionState, "· signalingState ->", pc.signalingState);
    }
    switch (pc.connectionState) {
      case "connected":
        callbacks.onStatusChange("connected");
        break;
      case "connecting":
        callbacks.onStatusChange("connecting");
        break;
      case "disconnected":
      case "closed":
        callbacks.onStatusChange("disconnected");
        break;
      case "failed":
        callbacks.onStatusChange("failed");
        break;
    }
  };

  pc.ondatachannel = (event): void => {
    if (event.channel.label === DATA_CHANNEL_LABEL) {
      configureDataChannel(event.channel);
      callbacks.onDataChannel(event.channel);
    }
  };

  return pc;
}

/** Creates an outbound data channel and configures it. */
export function createDataChannel(pc: RTCPeerConnection): RTCDataChannel {
  const channel = pc.createDataChannel(DATA_CHANNEL_LABEL, {
    ordered: true,
  });
  configureDataChannel(channel);
  return channel;
}

function configureDataChannel(channel: RTCDataChannel): void {
  channel.binaryType = "arraybuffer";
  channel.bufferedAmountLowThreshold = LOW_WATERMARK;
}

export interface SdpDescriptionResult {
  sdp: string;
}

/** Creates and sets the local offer, returning its SDP for signaling. */
export async function createOfferWithLocalDescription(
  pc: RTCPeerConnection,
): Promise<SdpDescriptionResult> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return { sdp: pc.localDescription?.sdp ?? "" };
}

/** Applies a remote offer and returns the generated answer SDP. */
export async function answerRemoteDescription(
  pc: RTCPeerConnection,
  sdp: string,
): Promise<SdpDescriptionResult> {
  await pc.setRemoteDescription({ type: "offer", sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return { sdp: pc.localDescription?.sdp ?? "" };
}

/** Forwards ICE candidates from signaling into the peer connection. */
export async function addIceCandidate(pc: RTCPeerConnection, candidate: RTCIceCandidate): Promise<void> {
  await pc.addIceCandidate(candidate);
}

export function serializeIceCandidate(candidate: RTCIceCandidate | null): IceCandidatePayload | null {
  if (!candidate) return null;
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  };
}