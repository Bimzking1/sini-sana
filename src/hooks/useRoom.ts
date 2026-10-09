import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomPhase } from "../types/room";
import type { ClientMessage, ServerMessage, SignalPayload } from "../types/signaling";
import { SignalingClient } from "../lib/signaling/signalingClient";
import { isDebugEnabled, rtcDebug } from "../lib/debug";
import { generateRoomCode, normalizeRoomCode } from "../lib/room/roomId";

export interface UseRoomOptions {
  signalingUrl: string;
}

export interface UseRoomResult {
  phase: RoomPhase;
  roomId: string | null;
  error: string | null;
  createRoom: () => Promise<void>;
  joinRoom: (code: string) => Promise<boolean>;
  reconnect: () => Promise<void>;
  leaveRoom: () => void;
  sendSignal: (payload: SignalPayload) => void;
  subscribeSignal: (handler: (payload: SignalPayload) => void) => () => void;
  subscribePeerJoined: (handler: () => void) => () => void;
  subscribePeerLeft: (handler: () => void) => () => void;
  subscribeClosed: (handler: () => void) => () => void;
}

const REQUEST_TIMEOUT_MS = 10_000;

interface PendingRequest {
  predicate: (message: ServerMessage) => boolean;
  resolve: (message: ServerMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function humanMessage(code: string, fallback: string): string {
  switch (code) {
    case "room-not-found":
      return "Room not found. It may have expired.";
    case "room-full":
      return "That room already has two devices connected.";
    case "invalid-room-id":
      return "That room code isn't valid.";
    default:
      return fallback;
  }
}

export function useRoom({ signalingUrl }: UseRoomOptions): UseRoomResult {
  const [phase, setPhase] = useState<RoomPhase>("idle");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<SignalingClient | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const intentionalCloseRef = useRef(false);
  const sessionTokenRef = useRef(0);

  function nextSessionToken(): number {
    sessionTokenRef.current += 1;
    return sessionTokenRef.current;
  }

  const signalListenersRef = useRef(new Set<(payload: SignalPayload) => void>());
  const peerJoinedListenersRef = useRef(new Set<() => void>());
  const peerLeftListenersRef = useRef(new Set<() => void>());
  const closedListenersRef = useRef(new Set<() => void>());

  useEffect(() => {
    const client = new SignalingClient(signalingUrl, {
      onMessage: handleServerMessage,
      onClosed: handleUnexpectedClose,
    });
    clientRef.current = client;
    return () => {
      client.disconnect();
      clientRef.current = null;
    };
    // Handlers only read refs and call setters, so a single registration is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalingUrl]);

  function handleServerMessage(message: ServerMessage): void {
    const pending = pendingRef.current;
    if (pending && pending.predicate(message)) {
      pendingRef.current = null;
      clearTimeout(pending.timer);
      pending.resolve(message);
      return;
    }
    if (message.type === "signal") {
      if (isDebugEnabled()) {
        if (message.data.kind === "end-session") {
          rtcDebug("received from signaling:", message.data.kind);
        } else if (message.data.kind === "ice-candidate") {
          rtcDebug("received from signaling:", message.data.kind, message.data.candidate.candidate);
        } else {
          rtcDebug("received from signaling:", message.data.kind, `${message.data.sdp.length} chars`);
        }
      }
      for (const handler of signalListenersRef.current) handler(message.data);
    } else if (message.type === "peer-joined") {
      for (const handler of peerJoinedListenersRef.current) handler();
    } else if (message.type === "peer-left") {
      for (const handler of peerLeftListenersRef.current) handler();
    }
  }

  function handleUnexpectedClose(): void {
    if (intentionalCloseRef.current) return;
    for (const handler of closedListenersRef.current) handler();
  }

  const request = useCallback(
    (message: ClientMessage, predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> => {
      const client = clientRef.current;
      if (!client) return Promise.reject(new Error("Signaling isn't available."));
      return new Promise<ServerMessage>((resolve, reject) => {
        const pending: PendingRequest = {
          predicate,
          resolve,
          reject,
          timer: setTimeout(() => {
            if (pendingRef.current === pending) {
              pendingRef.current = null;
              reject(new Error("The signaling server didn't respond in time."));
            }
          }, REQUEST_TIMEOUT_MS),
        };
        pendingRef.current = pending;
        if (!client.send(message)) {
          if (pendingRef.current === pending) {
            pendingRef.current = null;
            clearTimeout(pending.timer);
            reject(new Error("Couldn't reach the signaling server."));
          }
        }
      });
    },
    [],
  );

  const ensureSignaling = async (): Promise<void> => {
    const client = clientRef.current;
    if (!client) throw new Error("Signaling isn't available.");
    try {
      await client.open();
    } catch {
      throw new Error("Can't reach the signaling server. Check that it is running.");
    }
  };

  const resolveRoomError = (response: ServerMessage): string => {
    if (response.type !== "error") return "Something went wrong.";
    return humanMessage(response.code, response.message);
  };

  const createRoom = useCallback(async (): Promise<void> => {
    const token = nextSessionToken();
    setError(null);
    setPhase("creating");
    try {
      await ensureSignaling();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateRoomCode();
        const response = await request(
          { type: "create-room", roomId: code },
          (message) =>
            message.type === "room-created" ||
            (message.type === "error" &&
              (message.code === "room-id-taken" || message.code === "invalid-room-id")),
        );
        if (response.type === "room-created") {
          if (sessionTokenRef.current !== token) return;
          roomIdRef.current = response.roomId;
          setRoomId(response.roomId);
          setPhase("waiting");
          return;
        }
      }
      if (sessionTokenRef.current !== token) return;
      throw new Error("Couldn't create a room. Please try again.");
    } catch (caught) {
      if (sessionTokenRef.current !== token) return;
      const message = caught instanceof Error ? caught.message : "Couldn't create a room.";
      setError(message);
      setPhase("failed");
    }
  }, [request]);

  const joinRoom = useCallback(
    async (rawCode: string): Promise<boolean> => {
      const code = normalizeRoomCode(rawCode);
      const token = nextSessionToken();
      setError(null);
      if (!code) {
        setError("That room code isn't valid.");
        setPhase("idle");
        return false;
      }
      setPhase("connecting");
      try {
        await ensureSignaling();
        const response = await request(
          { type: "join-room", roomId: code },
          (message) =>
            message.type === "room-joined" ||
            (message.type === "error" &&
              (message.code === "room-not-found" ||
                message.code === "room-full" ||
                message.code === "invalid-room-id" ||
                message.code === "bad-message")),
        );
        if (response.type === "room-joined") {
          if (sessionTokenRef.current !== token) return false;
          roomIdRef.current = response.roomId;
          setRoomId(response.roomId);
          setPhase("connecting");
          return true;
        }
        if (sessionTokenRef.current !== token) return false;
        setError(resolveRoomError(response));
        setPhase("idle");
        return false;
      } catch (caught) {
        if (sessionTokenRef.current !== token) return false;
        const message = caught instanceof Error ? caught.message : "Couldn't join that room.";
        setError(message);
        setPhase("idle");
        return false;
      }
    },
    [request],
  );

  const reconnect = useCallback(async (): Promise<void> => {
    const id = roomIdRef.current;
    const token = nextSessionToken();
    setError(null);
    if (!id) {
      setError("There's no room to reconnect to.");
      setPhase("idle");
      return;
    }
    setPhase("connecting");
    try {
      await ensureSignaling();
      const response = await request(
        { type: "join-room", roomId: id },
        (message) =>
          message.type === "room-joined" ||
          (message.type === "error" &&
            (message.code === "room-not-found" ||
              message.code === "room-full" ||
              message.code === "invalid-room-id" ||
              message.code === "bad-message")),
      );
      if (sessionTokenRef.current !== token) return;
      if (response.type === "room-joined") {
        setPhase("connecting");
        return;
      }
      setError(resolveRoomError(response));
      setPhase("idle");
    } catch (caught) {
      if (sessionTokenRef.current !== token) return;
      const message = caught instanceof Error ? caught.message : "Couldn't reconnect.";
      setError(message);
      setPhase("failed");
    }
  }, [request]);

  const leaveRoom = useCallback((): void => {
    intentionalCloseRef.current = true;
    sessionTokenRef.current += 1;
    const client = clientRef.current;
    if (client) {
      client.send({ type: "leave-room" });
      client.disconnect();
    }
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      clearTimeout(pending.timer);
      pending.reject(new Error("Room was left."));
    }
    roomIdRef.current = null;
    setRoomId(null);
    setError(null);
    setPhase("idle");
  }, []);

  const sendSignal = useCallback((payload: SignalPayload): void => {
    if (isDebugEnabled()) {
      if (payload.kind === "end-session") {
        rtcDebug("sending to signaling:", payload.kind);
      } else if (payload.kind === "ice-candidate") {
        rtcDebug("sending to signaling:", payload.kind, payload.candidate.candidate);
      } else {
        rtcDebug("sending to signaling:", payload.kind, `${payload.sdp.length} chars`);
      }
    }
    clientRef.current?.send({ type: "signal", data: payload });
  }, []);

  const subscribeSignal = useCallback((handler: (payload: SignalPayload) => void): (() => void) => {
    signalListenersRef.current.add(handler);
    return () => {
      signalListenersRef.current.delete(handler);
    };
  }, []);

  const subscribePeerJoined = useCallback((handler: () => void): (() => void) => {
    peerJoinedListenersRef.current.add(handler);
    return () => {
      peerJoinedListenersRef.current.delete(handler);
    };
  }, []);

  const subscribePeerLeft = useCallback((handler: () => void): (() => void) => {
    peerLeftListenersRef.current.add(handler);
    return () => {
      peerLeftListenersRef.current.delete(handler);
    };
  }, []);

  const subscribeClosed = useCallback((handler: () => void): (() => void) => {
    closedListenersRef.current.add(handler);
    return () => {
      closedListenersRef.current.delete(handler);
    };
  }, []);

  return useMemo(
    () => ({
      phase,
      roomId,
      error,
      createRoom,
      joinRoom,
      reconnect,
      leaveRoom,
      sendSignal,
      subscribeSignal,
      subscribePeerJoined,
      subscribePeerLeft,
      subscribeClosed,
    }),
    [
      phase,
      roomId,
      error,
      createRoom,
      joinRoom,
      reconnect,
      leaveRoom,
      sendSignal,
      subscribeSignal,
      subscribePeerJoined,
      subscribePeerLeft,
      subscribeClosed,
    ],
  );
}