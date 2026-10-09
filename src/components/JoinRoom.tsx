import { useCallback, useRef, useState } from "react";
import { normalizeRoomCode, parseRoomCodeFromUrl } from "../lib/room/roomId";
import QrScanner from "./QrScanner";

interface JoinRoomProps {
  onSubmit: (code: string) => void;
}

type Mode = "code" | "scan";

function extractRoomCode(raw: string): string | null {
  const direct = normalizeRoomCode(raw);
  if (direct) return direct;
  const fromUrl = parseRoomCodeFromUrl(raw);
  return fromUrl ? normalizeRoomCode(fromUrl) : null;
}

export default function JoinRoom({ onSubmit }: JoinRoomProps) {
  const [mode, setMode] = useState<Mode>("code");
  const [value, setValue] = useState("");
  const [scanKey, setScanKey] = useState(0);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (value.trim().length === 0) return;
    onSubmit(value);
  };

  const clearNoticeSoon = (message: string): void => {
    setScanNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setScanNotice(null), 3000);
  };

  const handleScan = useCallback(
    (raw: string): void => {
      const code = extractRoomCode(raw);
      if (code) {
        onSubmit(code);
        return;
      }
      clearNoticeSoon("That QR code isn't a Sini Sana room.");
      setScanKey((key) => key + 1);
    },
    [onSubmit],
  );

  const tabClass = (active: boolean): string =>
    `rounded-full px-4 py-2 font-display text-sm font-semibold transition ${
      active
        ? "bg-gradient-to-r from-brand-blue to-brand-light-blue text-white shadow-sm shadow-brand-blue/20"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    }`;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900 md:p-6">
      <div className="flex justify-center gap-1">
        <button type="button" onClick={() => setMode("code")} className={tabClass(mode === "code")}>
          Enter code
        </button>
        <button type="button" onClick={() => setMode("scan")} className={tabClass(mode === "scan")}>
          Scan QR
        </button>
      </div>

      {mode === "code" ? (
        <form onSubmit={submit} className="mt-5">
          <label htmlFor="join-code" className="block text-center text-sm font-medium text-slate-600 dark:text-slate-300">
            Join an existing room
          </label>
          <div className="mt-3 flex gap-2 md:mt-4">
            <input
              id="join-code"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Room code"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={10}
              className="w-full flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-3 font-mono text-base uppercase tracking-widest text-slate-900 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/30 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-light-blue dark:focus:ring-brand-light-blue/30"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-brand-blue to-brand-light-blue px-6 py-3 font-display text-sm font-semibold text-white shadow-sm transition hover:from-brand-dark-blue hover:to-brand-blue active:scale-[0.98]"
            >
              Join
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Opening your camera…
        </p>
      )}

      {mode === "scan" && (
        <QrScanner key={scanKey} onResult={handleScan} onClose={() => setMode("code")} notice={scanNotice} />
      )}
    </div>
  );
}