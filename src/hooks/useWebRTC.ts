import { useCallback, useEffect, useRef } from "react";
import type { IceCandidatePayload, SignalPayload } from "../types/signaling";
import type { IncomingTransferEvent, TextMessage } from "../types/transfer";
import { reasonForConnectionFailure, type WebRtcStatus } from "../types/webrtc";
import { isDebugEnabled, rtcDebug } from "../lib/debug";
import { isChannelOpen, LOW_WATERMARK } from "../lib/webrtc/dataChannel";
import { sendTextMessage, sendFilesSequential, IncomingFileManager, handleIncomingData } from "../lib/webrtc/fileTransfer";
import type { FileEntry } from "../lib/webrtc/fileTransfer";
import {
  createDataChannel,
  createOfferWithLocalDescription,
  answerRemoteDescription,
  createPeerConnection,
  serializeIceCandidate,
} from "../lib/webrtc/peerConnection";
import type { ChannelData } from "../types/transfer";

export interface UseWebRtcOptions {
  iceServers: RTCIceServer[];
  sendSignal: (payload: SignalPayload) => void;
  onStatusChange: (status: WebRtcStatus, message?: string) => void;
  onIncoming: (event: IncomingTransferEvent) => void;
  onFileProgress: (key: string, name: string, sentBytes: number, progress: number) => void;
  onFileComplete: (key: string) => void;
  onFileFailed: (key: string, message: string) => void;
}

export interface UseWebRtcResult {
  /** Starts an offer toward the peer (react to `peer-joined`). */
  connect: () => void;
  /** Feeds signaling messages from the room into the peer connection. */
  handleSignal: (payload: SignalPayload) => void;
  sendText: (content: string) => TextMessage | null;
  sendFiles: (entries: FileEntry[]) => void;
  isOpen: () => boolean;
  tearDown: () => void;
}

function toChannelData(data: unknown): ChannelData | null {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return data;
  return null;
}

export function useWebRTC(options: UseWebRtcOptions): UseWebRtcResult {
  const propsRef = useRef(options);
  propsRef.current = options;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const incomingRef = useRef<IncomingFileManager | null>(null);
  const candidateQueueRef = useRef<RTCIceCandidate[]>([]);
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const dcOpenRef = useRef(false);
  const sentOfferRef = useRef(false);

  function resetChannel(): void {
    const channel = dcRef.current;
    dcRef.current = null;
    if (channel) {
      channel.onopen = null;
      channel.onmessage = null;
      channel.onclose = null;
      channel.onerror = null;
      try {
        channel.close();
      } catch {
        // Already closed.
      }
    }
    incomingRef.current = null;
    dcOpenRef.current = false;
  }

  function resetPc(): void {
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      if (isDebugEnabled()) rtcDebug("closing peer connection");
      pc.onicecandidate = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.ondatachannel = null;
      try {
        pc.close();
      } catch {
        // Already closed.
      }
    }
    resetChannel();
    candidateQueueRef.current = [];
    sendQueueRef.current = Promise.resolve();
    sentOfferRef.current = false;
  }

  function ensurePc(): RTCPeerConnection {
    const current = pcRef.current;
    if (current && current.connectionState !== "closed" && current.connectionState !== "failed") {
      return current;
    }
    resetPc();
    const pc = createPeerConnection(options.iceServers, {
      onIceCandidate: (candidate) => {
        const serialized = serializeIceCandidate(candidate);
        if (serialized) {
          options.sendSignal({ kind: "ice-candidate", candidate: serialized });
        }
      },
      onDataChannel: (channel) => wireChannel(channel),
      onStatusChange: (status) => {
        if (pcRef.current !== pc) return;
        const props = propsRef.current;
        if (status === "connected") {
          // "Connected" is only reported once the data channel is open.
          if (dcOpenRef.current) props.onStatusChange("connected");
        } else if (status === "disconnected") {
          props.onStatusChange("disconnected");
        } else if (status === "failed") {
          props.onStatusChange("failed", reasonForConnectionFailure(pc.connectionState));
        } else {
          props.onStatusChange(status);
        }
      },
    });
    pcRef.current = pc;
    return pc;
  }

  function wireChannel(channel: RTCDataChannel): void {
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = LOW_WATERMARK;

    const incoming = new IncomingFileManager({
      onStart: (start) => {
        propsRef.current.onIncoming({
          kind: "file-start",
          id: start.id,
          name: start.name,
          size: start.size,
          mimeType: start.mimeType,
        });
      },
      onProgress: (id, received) => {
        propsRef.current.onIncoming({ kind: "file-progress", id, received });
      },
      onComplete: (id, blob, start) => {
        propsRef.current.onIncoming({ kind: "file-complete", id, name: start.name, mimeType: start.mimeType, blob });
      },
      onAbort: (id) => {
        propsRef.current.onIncoming({ kind: "file-cancelled", id });
      },
      onError: (id, message) => {
        propsRef.current.onIncoming({ kind: "file-failed", id, message });
      },
    });
    incomingRef.current = incoming;
    dcRef.current = channel;

    channel.onmessage = (event): void => {
      const data = toChannelData(event.data);
      if (data === null) return;
      handleIncomingData(data, incoming, (text) => {
        propsRef.current.onIncoming({ kind: "text", message: text });
      });
    };

    channel.onopen = (): void => {
      if (pcRef.current == null) return;
      dcOpenRef.current = true;
      sentOfferRef.current = false;
      propsRef.current.onStatusChange("connected");
    };

    channel.onclose = (): void => {
      if (dcRef.current !== channel) return;
      incoming.handleChannelClosed();
      resetChannel();
      propsRef.current.onStatusChange("disconnected");
    };

    channel.onerror = (): void => {
      // The 'close' event performs the cleanup and notification.
    };
  }

  function flushCandidates(pc: RTCPeerConnection): void {
    const queued = candidateQueueRef.current;
    candidateQueueRef.current = [];
    for (const candidate of queued) {
      void pc.addIceCandidate(candidate).catch(() => {
        // A stale candidate is harmless.
      });
    }
  }

  async function acceptOffer(sdp: string): Promise<void> {
    const current = pcRef.current;
    if (current && (current.connectionState === "connected" || current.signalingState === "have-local-offer")) {
      return;
    }
    resetPc();
    const pc = ensurePc();
    try {
      const answer = await answerRemoteDescription(pc, sdp);
      if (pcRef.current !== pc) return;
      flushCandidates(pc);
      if (isDebugEnabled()) rtcDebug("answerer: sending answer", answer.sdp.length, "chars");
      propsRef.current.sendSignal({ kind: "answer", sdp: answer.sdp });
    } catch {
      propsRef.current.onStatusChange("failed", "Couldn't connect to the other device.");
    }
  }

  async function acceptAnswer(sdp: string): Promise<void> {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription({ type: "answer", sdp });
      flushCandidates(pc);
    } catch {
      // A stale or duplicate answer can be safely ignored.
    }
  }

  async function acceptCandidate(candidate: IceCandidatePayload): Promise<void> {
    const pc = pcRef.current;
    if (!pc) return;
    const payload: RTCIceCandidateInit = {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? undefined,
      sdpMLineIndex: candidate.sdpMLineIndex ?? undefined,
    };
    if (pc.remoteDescription === null) {
      if (isDebugEnabled()) rtcDebug("queued remote candidate (no remote description yet)");
      candidateQueueRef.current.push(new RTCIceCandidate(payload));
      return;
    }
    if (isDebugEnabled()) rtcDebug("adding remote candidate", candidate.candidate);
    try {
      await pc.addIceCandidate(payload);
    } catch {
      // A stale candidate is harmless.
    }
  }

  const connect = useCallback((): void => {
    const current = pcRef.current;
    const negotiating =
      current !== null &&
      (current.signalingState === "have-local-offer" || current.signalingState === "have-remote-offer");
    if (negotiating || (current?.connectionState === "connected" && dcOpenRef.current)) return;

    void (async (): Promise<void> => {
      resetPc();
      const pc = ensurePc();
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        propsRef.current.onStatusChange("failed");
        return;
      }
      const channel = createDataChannel(pc);
      wireChannel(channel);
      sentOfferRef.current = true;
      if (isDebugEnabled()) rtcDebug("offerer: created data channel; creating offer");
      try {
        const { sdp } = await createOfferWithLocalDescription(pc);
        if (!sdp) throw new Error("Failed to create a connection offer.");
        if (isDebugEnabled()) rtcDebug("offerer: sending offer", sdp.length, "chars");
        propsRef.current.sendSignal({ kind: "offer", sdp });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Connection setup failed.";
        propsRef.current.onStatusChange("failed", message);
      }
    })();
  }, [options.iceServers, options.sendSignal]);

  const handleSignal = useCallback((payload: SignalPayload): void => {
    if (isDebugEnabled()) {
      if (payload.kind === "end-session") {
        rtcDebug("signal received:", payload.kind);
      } else if (payload.kind === "ice-candidate") {
        rtcDebug("signal received:", payload.kind, payload.candidate.candidate);
      } else {
        rtcDebug("signal received:", payload.kind, `${payload.sdp.length} chars`);
      }
    }
    switch (payload.kind) {
      case "offer":
        void acceptOffer(payload.sdp);
        break;
      case "answer":
        void acceptAnswer(payload.sdp);
        break;
      case "ice-candidate":
        void acceptCandidate(payload.candidate);
        break;
      case "end-session":
        // The room layer handles session closure; nothing to negotiate here.
        break;
    }
    // Handlers close over refs only; no dependency on changing props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendText = useCallback((content: string): TextMessage | null => {
    const channel = dcRef.current;
    if (!channel || !isChannelOpen(channel)) return null;
    return sendTextMessage(channel, content);
  }, []);

  const sendFiles = useCallback((entries: FileEntry[]): void => {
    if (entries.length === 0) return;
    const chain = sendQueueRef.current;
    sendQueueRef.current = chain
      .then(async () => {
        const channel = dcRef.current;
        if (!channel || !isChannelOpen(channel)) {
          for (const entry of entries) {
            propsRef.current.onFileFailed(entry.key, "The connection isn't ready yet.");
          }
          return;
        }
        await sendFilesSequential(channel, entries, {
          onProgress: (key, name, sentBytes, progress) =>
            propsRef.current.onFileProgress(key, name, sentBytes, progress),
          onComplete: (key) => propsRef.current.onFileComplete(key),
          onError: (key, message) => propsRef.current.onFileFailed(key, message),
        });
      })
      .catch(() => {
        for (const entry of entries) {
          propsRef.current.onFileFailed(entry.key, "Couldn't send the file.");
        }
      });
  }, []);

  const isOpen = useCallback((): boolean => {
    return dcOpenRef.current;
  }, []);

  const tearDown = useCallback((): void => {
    resetPc();
  }, []);

  useEffect(() => {
    return () => {
      resetPc();
    };
    // Only tear down on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connect,
    handleSignal,
    sendText,
    sendFiles,
    isOpen,
    tearDown,
  };
}