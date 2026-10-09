import { useEffect, useMemo, useRef, useState } from "react";
import type { TransferItem as TransferItemModel } from "../types/transfer";
import { useClipboard } from "../hooks/useClipboard";
import { formatBytes, formatPercent, formatProgressTotal } from "../lib/webrtc/progress";

interface TransferItemProps {
  item: TransferItemModel;
  onNotice: (message: string) => void;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function TransferItem({ item, onNotice }: TransferItemProps) {
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { copy, error } = useClipboard();

  const blob = item.kind === "file" ? item.blob : undefined;
  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
    };
  }, []);

  const handleCopy = async (text: string): Promise<void> => {
    const ok = await copy(text);
    if (ok) {
      setCopied(true);
      if (copyResetRef.current) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopied(false), 1500);
    } else if (error) {
      onNotice(error);
    }
  };

  const time = formatTime(item.timestamp);

  if (item.kind === "text") {
    return (
      <div className="animate-fade-up rounded-3xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:px-5 md:py-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {item.direction === "sent" ? "Sent" : "Received"} · {time}
          </span>
          <button
            type="button"
            onClick={() => void handleCopy(item.content)}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-slate-800 dark:text-slate-100 md:text-base">
          {item.content}
        </p>
      </div>
    );
  }

  const done = item.state === "done";
  const isImage = done && item.mimeType.startsWith("image/");
  const progress = Math.max(0, Math.min(1, item.progress));
  const transferred = Math.round(item.size * progress);

  return (
    <div className="animate-fade-up rounded-3xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:px-5 md:py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-white md:text-base">
            {item.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {item.direction === "sent" ? "Sent" : "Received"} · {time}
            {done && item.direction === "received" && <span className="text-brand-blue dark:text-brand-light-blue"> · received</span>}
          </p>
        </div>
        {done ? (
          blob && (
            <a
              href={objectUrl ?? undefined}
              download={item.name}
              className="shrink-0 rounded-xl bg-gradient-to-r from-brand-blue to-brand-light-blue px-3.5 py-2 font-display text-xs font-semibold text-white shadow-sm transition hover:from-brand-dark-blue hover:to-brand-blue active:scale-[0.98]"
            >
              Download
            </a>
          )
        ) : (
          <span className="shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {formatPercent(progress)}
          </span>
        )}
      </div>

      {isImage && objectUrl && (
        <img
          src={objectUrl}
          alt={item.name}
          className="mt-3 max-h-64 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-800"
        />
      )}

      {item.state === "progress" && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-blue"
              style={{ width: `${formatPercent(progress)}` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {item.direction === "sent" ? "Sending" : "Receiving"} {item.name} ·{" "}
            {formatProgressTotal(transferred, item.size)}
          </p>
        </div>
      )}

      {item.state === "failed" && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
          {item.error ?? "The transfer failed."}
        </p>
      )}
      {item.state === "progress" && item.size > 0 && (
        <p className="sr-only">
          {formatBytes(transferred)} of {formatBytes(item.size)}
        </p>
      )}
    </div>
  );
}