import type { RoomPhase } from "../types/room";

const STATUS: Record<RoomPhase, { label: string; dot: string; pulse: boolean }> = {
  idle: { label: "Not connected", dot: "bg-slate-300 dark:bg-slate-600", pulse: false },
  creating: { label: "Creating room…", dot: "bg-brand-orange", pulse: true },
  waiting: { label: "Waiting for a friend…", dot: "bg-brand-orange", pulse: true },
  connecting: { label: "High-fiving…", dot: "bg-brand-light-blue", pulse: true },
  connected: { label: "Connected", dot: "bg-brand-blue", pulse: false },
  disconnected: { label: "Disconnected", dot: "bg-slate-400 dark:bg-slate-500", pulse: false },
  failed: { label: "Connection failed", dot: "bg-rose-500", pulse: false },
};

interface ConnectionStatusProps {
  phase: RoomPhase;
  connectedLabel?: string;
}

export default function ConnectionStatus({ phase, connectedLabel }: ConnectionStatusProps) {
  const status = STATUS[phase];
  const label = phase === "connected" && connectedLabel ? connectedLabel : status.label;

  if (phase === "connected") {
    return (
      <span className="animate-pop inline-flex items-center gap-2 rounded-full bg-brand-light-blue/10 px-2.5 py-1 text-sm font-semibold text-brand-blue ring-1 ring-brand-light-blue/30 dark:bg-brand-blue/15 dark:text-brand-light-blue dark:ring-brand-blue/40 sm:px-3">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-light-blue opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-blue" />
        </span>
        <span className="hidden sm:inline">{label}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${status.dot} ${status.pulse ? "animate-pulse" : ""}`}
      />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}