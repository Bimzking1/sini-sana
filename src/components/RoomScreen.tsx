import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomPhase } from "../types/room";
import type { IncomingTransferEvent, TransferItem } from "../types/transfer";
import type { WebRtcStatus } from "../types/webrtc";
import { buildRoomUrl } from "../lib/room/roomId";
import { useAppConfig } from "../hooks/useAppConfig";
import { useRoom } from "../hooks/useRoom";
import { useWebRTC } from "../hooks/useWebRTC";
import { useClipboard } from "../hooks/useClipboard";
import { computeProgress } from "../lib/webrtc/progress";
import type { FileEntry } from "../lib/webrtc/fileTransfer";
import ConnectionStatus from "./ConnectionStatus";
import QRCode from "./QRCode";
import TextComposer from "./TextComposer";
import FileDropzone from "./FileDropzone";
import TransferList from "./TransferList";
import Toast from "./Toast";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

interface RoomScreenProps {
  mode: "create" | "join";
  code: string | null;
  onLeave: () => void;
}

function describesMobileDevice(): boolean {
  if (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches) {
    return true;
  }
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function RoomScreen({ mode, code, onLeave }: RoomScreenProps) {
  const config = useAppConfig();
  const [phase, setPhase] = useState<RoomPhase>(mode === "create" ? "creating" : "connecting");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<TransferItem[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const room = useRoom({ signalingUrl: config.signalingUrl });
  const roomRef = useRef(room);
  roomRef.current = room;

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveRequestedRef = useRef(false);
  const sessionEndedRef = useRef(false);

  const pushNotice = useCallback((text: string): void => {
    setNotice(text);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const onStatusChange = useCallback((status: WebRtcStatus, detail?: string): void => {
    if (status === "connected") {
      setMessage("");
      setPhase("connected");
    } else if (status === "connecting") {
      setPhase("connecting");
      setMessage("");
    } else if (status === "disconnected") {
      setPhase("disconnected");
      if (detail) setMessage(detail);
    } else {
      setMessage(detail ?? "Couldn't connect to the other device.");
      setPhase("failed");
    }
  }, []);

  const onIncoming = useCallback((event: IncomingTransferEvent): void => {
    switch (event.kind) {
      case "text": {
        const { message: text } = event;
        setHistory((current) => [
          ...current,
          {
            id: text.id,
            direction: "received",
            kind: "text",
            content: text.content,
            timestamp: text.timestamp,
            state: "done",
          },
        ]);
        break;
      }
      case "file-start":
        setHistory((current) => [
          ...current,
          {
            id: event.id,
            direction: "received",
            kind: "file",
            name: event.name,
            size: event.size,
            mimeType: event.mimeType,
            timestamp: Date.now(),
            state: "progress",
            progress: 0,
          },
        ]);
        break;
      case "file-progress":
        setHistory((current) =>
          current.map((item) =>
            item.kind === "file" && item.id === event.id
              ? { ...item, progress: computeProgress(event.received, item.size) }
              : item,
          ),
        );
        break;
      case "file-complete":
        setHistory((current) =>
          current.map((item) =>
            item.kind === "file" && item.id === event.id
              ? { ...item, blob: event.blob, state: "done", progress: 1 }
              : item,
          ),
        );
        break;
      case "file-cancelled":
        setHistory((current) =>
          current.map((item) =>
            item.kind === "file" && item.id === event.id
              ? { ...item, state: "failed", error: "The other device cancelled this transfer." }
              : item,
          ),
        );
        break;
      case "file-failed":
        setHistory((current) =>
          current.map((item) =>
            item.kind === "file" && item.id === event.id
              ? { ...item, state: "failed", error: event.message }
              : item,
          ),
        );
        break;
    }
  }, []);

  const rtc = useWebRTC({
    iceServers: config.iceServers,
    sendSignal: room.sendSignal,
    onStatusChange,
    onIncoming,
    onFileProgress: useCallback((key: string, _name: string, _sentBytes: number, progress: number) => {
      setHistory((current) =>
        current.map((item) =>
          item.kind === "file" && item.id === key ? { ...item, progress } : item,
        ),
      );
    }, []),
    onFileComplete: useCallback((key: string) => {
      setHistory((current) =>
        current.map((item) =>
          item.kind === "file" && item.id === key ? { ...item, state: "done", progress: 1 } : item,
        ),
      );
    }, []),
    onFileFailed: useCallback((key: string, errorMessage: string) => {
      setHistory((current) =>
        current.map((item) =>
          item.kind === "file" && item.id === key
            ? { ...item, state: "failed", error: errorMessage }
            : item,
        ),
      );
    }, []),
  });
  const rtcRef = useRef(rtc);
  rtcRef.current = rtc;

  useEffect(() => {
    const unsubscribeSignal = room.subscribeSignal((payload) => {
      if (payload.kind === "end-session") {
        sessionEndedRef.current = true;
        rtcRef.current.tearDown();
        setSessionEnded(true);
        setMessage("The creator closed this room.");
        return;
      }
      rtcRef.current.handleSignal(payload);
    });
    const unsubscribePeerJoined = room.subscribePeerJoined(() => {
      setMessage("");
      setPhase("connecting");
      rtcRef.current.connect();
    });
    const unsubscribePeerLeft = room.subscribePeerLeft(() => {
      if (sessionEndedRef.current) {
        rtcRef.current.tearDown();
        return;
      }
      setMessage("The other device disconnected. Waiting for it to reconnect…");
      setPhase("disconnected");
      rtcRef.current.tearDown();
    });
    const unsubscribeClosed = room.subscribeClosed(() => {
      if (rtcRef.current.isOpen()) {
        pushNotice("Connection to the signaling server was lost, but your devices are still connected.");
      } else {
        setMessage("Connection to the signaling server was lost.");
        setPhase("failed");
      }
    });
    return () => {
      unsubscribeSignal();
      unsubscribePeerJoined();
      unsubscribePeerLeft();
      unsubscribeClosed();
    };
  }, [room, pushNotice]);

  useEffect(() => {
    void (mode === "create" ? room.createRoom() : code ? room.joinRoom(code) : undefined);
    // Start the session once per mount for the given room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "create" || !room.roomId) return;
    const hash = `#${room.roomId}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
    }
  }, [mode, room.roomId]);

  useEffect(() => {
    return () => {
      if (leaveRequestedRef.current) return;
      rtcRef.current.tearDown();
      roomRef.current.leaveRoom();
    };
  }, []);

  const handleSendText = useCallback(
    (content: string): void => {
      const sent = rtcRef.current.sendText(content);
      if (!sent) {
        pushNotice("You're not connected yet.");
        return;
      }
      setHistory((current) => [
        ...current,
        {
          id: sent.id,
          direction: "sent",
          kind: "text",
          content: sent.content,
          timestamp: sent.timestamp,
          state: "done",
        },
      ]);
    },
    [pushNotice],
  );

  const handleSendFiles = useCallback(
    (entries: FileEntry[]): void => {
      if (!rtcRef.current.isOpen()) {
        pushNotice("You're not connected yet.");
        return;
      }
      const timestamp = Date.now();
      const items: TransferItem[] = entries.map((entry) => ({
        id: entry.key,
        direction: "sent",
        kind: "file",
        name: entry.name,
        size: entry.file.size,
        mimeType: entry.file.type || "application/octet-stream",
        timestamp,
        state: "progress",
        progress: 0,
      }));
      setHistory((current) => [...current, ...items]);
      rtcRef.current.sendFiles(entries);
    },
    [pushNotice],
  );

  const finishLeaving = useCallback((): void => {
    leaveRequestedRef.current = true;
    rtcRef.current.tearDown();
    roomRef.current.leaveRoom();
    onLeave();
  }, [onLeave]);

  const handleLeave = useCallback((): void => {
    finishLeaving();
  }, [finishLeaving]);

  const handleEndSession = useCallback((): void => {
    if (confirmEnd) {
      if (confirmEndTimerRef.current) clearTimeout(confirmEndTimerRef.current);
      roomRef.current.sendSignal({ kind: "end-session" });
      finishLeaving();
      return;
    }
    setConfirmEnd(true);
    if (confirmEndTimerRef.current) clearTimeout(confirmEndTimerRef.current);
    confirmEndTimerRef.current = setTimeout(() => setConfirmEnd(false), 3000);
  }, [confirmEnd, finishLeaving]);

  const connectedLabel = phase === "connected" && describesMobileDevice() ? "Phone connected" : undefined;
  const isCreator = mode === "create";

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Logo size={28} className="shrink-0" />
            <span className="font-semibold tracking-tight text-slate-900 dark:text-white">Sini Sana</span>
            {room.roomId && (
              <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 md:text-sm">
                {room.roomId}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
            <ConnectionStatus phase={phase} connectedLabel={connectedLabel} />
            <ThemeToggle />
            {isCreator && !sessionEnded ? (
              <button
                type="button"
                onClick={handleEndSession}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition md:px-3 ${
                  confirmEnd
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                }`}
              >
                {confirmEnd ? "Sure? Tap again" : "End"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLeave}
                className="rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:px-3 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {phase === "connected" ? "Leave" : "Back"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 md:gap-6 md:px-6 md:py-10">
        {sessionEnded && (
          <div className="animate-pop rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm md:p-10 dark:border-slate-800 dark:bg-slate-900">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 md:h-14 md:w-14 dark:bg-rose-500/10 dark:text-rose-400">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10.5 6V3.5a2.5 2.5 0 0 0-5 0V6M4 6h8l-.6 7.2a1 1 0 0 1-1 .8H5.6a1 1 0 0 1-1-.8L4 6Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-900 md:text-2xl dark:text-white">
              Room closed
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 md:text-base dark:text-slate-400">
              The creator ended this session. Everything you already received is still here.
            </p>
            <button
              type="button"
              onClick={handleLeave}
              className="mt-6 rounded-xl bg-gradient-to-r from-brand-blue to-brand-light-blue px-6 py-2.5 font-display text-sm font-semibold text-white shadow-sm transition hover:from-brand-dark-blue hover:to-brand-blue active:scale-[0.98] md:px-8"
            >
              Back home
            </button>
          </div>
        )}

        {!sessionEnded && (phase === "failed" || (phase === "idle" && room.error)) && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center md:p-10 dark:border-rose-500/30 dark:bg-rose-500/10">
            <h2 className="text-base font-bold text-rose-900 md:text-xl dark:text-rose-200">
              {room.error ?? "Connection failed"}
            </h2>
            {message && <p className="mt-1 text-sm text-rose-700 md:text-base dark:text-rose-300">{message}</p>}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {room.roomId && (
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    void room.reconnect();
                  }}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-[0.98]"
                >
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={handleLeave}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-800"
              >
                Back home
              </button>
            </div>
          </div>
        )}

        {!sessionEnded && phase === "disconnected" && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm md:p-10 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 md:text-xl dark:text-white">
              {message || "The other device disconnected."}
            </h2>
            <p className="mt-1 text-sm text-slate-500 md:text-base dark:text-slate-400">
              Keep this page open — the other device can rejoin the same room.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleLeave}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-800"
              >
                Back home
              </button>
            </div>
          </div>
        )}

        {!sessionEnded &&
          (phase === "creating" || phase === "waiting" || phase === "connecting") && (
            <SetupPanel roomId={room.roomId} phase={phase} onNotice={pushNotice} />
          )}

        {!sessionEnded && phase === "connected" && (
          <>
            <TextComposer onSend={handleSendText} disabled={phase !== "connected"} onNotice={pushNotice} />
            <FileDropzone onSend={handleSendFiles} disabled={phase !== "connected"} onNotice={pushNotice} />
            <TransferList items={history} onNotice={pushNotice} />
          </>
        )}
      </main>

      {notice && <Toast>{notice}</Toast>}
    </div>
  );
}

interface SetupPanelProps {
  roomId: string | null;
  phase: RoomPhase;
  onNotice: (message: string) => void;
}

function BouncingDots() {
  return (
    <span className="inline-flex items-end gap-1" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-brand-orange" />
      <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-brand-orange [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-brand-orange [animation-delay:240ms]" />
    </span>
  );
}

function SetupPanel({ roomId, phase, onNotice }: SetupPanelProps) {
  const [copied, setCopied] = useState(false);
  const { copy, error } = useClipboard();

  const handleCopyLink = async (): Promise<void> => {
    if (!roomId) return;
    const ok = await copy(buildRoomUrl(roomId));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else if (error) {
      onNotice(error);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-8 text-center shadow-sm transition-transform md:px-10 md:py-12 dark:border-slate-800 dark:bg-slate-900">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 animate-float-slow rounded-full bg-brand-light-blue/20 blur-2xl dark:bg-brand-blue/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 animate-float-slow rounded-full bg-brand-orange/15 blur-2xl [animation-delay:2s] dark:bg-brand-orange/10"
      />
      {roomId ? (
        <div className="relative">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Room code · scan or share
          </p>
          <p className="mt-3 bg-gradient-to-r from-brand-light-orange via-brand-orange to-brand-blue bg-clip-text font-mono text-4xl font-bold tracking-[0.18em] text-transparent md:text-6xl">
            {roomId}
          </p>
          <div className="mt-6 flex justify-center">
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 md:p-4 dark:ring-slate-700">
              <QRCode value={buildRoomUrl(roomId)} size={176} className="md:hidden" />
              <QRCode value={buildRoomUrl(roomId)} size={224} className="hidden md:inline-block" />
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-sm text-sm text-slate-500 md:text-base dark:text-slate-400">
            Scan with your phone, or open the copied link on another device
          </p>
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            className="mt-5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-light-blue px-6 py-2.5 font-display text-sm font-semibold text-white shadow-sm transition hover:from-brand-dark-blue hover:to-brand-blue active:scale-[0.98] md:px-8"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      ) : (
        <div className="relative">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-orange to-brand-blue shadow-lg shadow-brand-blue/25">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </span>
          <p className="mt-5 text-sm font-medium text-slate-600 md:text-base dark:text-slate-300">
            {phase === "creating" ? (
              <span className="inline-flex items-center gap-2">
                Creating room <BouncingDots />
              </span>
            ) : (
              "Waiting for another device…"
            )}
          </p>
        </div>
      )}
      <div className="relative mt-8 border-t border-slate-100 pt-5 md:mt-10 dark:border-slate-800">
        <ConnectionStatus phase={phase} />
      </div>
    </div>
  );
}