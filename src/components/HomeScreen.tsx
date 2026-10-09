import { useState } from "react";
import { normalizeRoomCode } from "../lib/room/roomId";
import Logo from "./Logo";
import CreateRoom from "./CreateRoom";
import JoinRoom from "./JoinRoom";
import ThemeToggle from "./ThemeToggle";

interface HomeScreenProps {
  onCreate: () => void;
  onJoin: (code: string) => void;
  onOpenHowTo: () => void;
}

export default function HomeScreen({ onCreate, onJoin, onOpenHowTo }: HomeScreenProps) {
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleJoin = (raw: string): void => {
    const code = normalizeRoomCode(raw);
    if (!code) {
      setCodeError("That room code isn't valid. It should be 6 letters or numbers.");
      return;
    }
    setCodeError(null);
    onJoin(code);
  };

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 animate-float-slow rounded-full bg-brand-light-blue/20 blur-3xl dark:bg-brand-blue/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 animate-float-slow rounded-full bg-brand-orange/20 blur-3xl [animation-delay:2s] dark:bg-brand-orange/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-1/4 h-72 w-72 animate-float-slow rounded-full bg-brand-blue/15 blur-3xl [animation-delay:4s] dark:bg-brand-blue/10"
      />

      <div className="absolute right-4 top-4 z-10 md:right-6 md:top-6">
        <ThemeToggle />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-12 md:py-16">
        <div className="flex flex-col items-center text-center">
          <Logo size={52} className="md:h-16 md:w-16" />
          <h1 className="mt-5 bg-gradient-to-r from-brand-light-orange via-brand-orange to-brand-blue bg-clip-text text-4xl font-bold tracking-tight text-transparent dark:from-brand-light-orange dark:via-brand-orange dark:to-brand-light-blue md:text-6xl">
            Sini Sana
          </h1>
          <p className="mt-3 max-w-sm text-base text-slate-600 dark:text-slate-400 md:text-lg md:max-w-md">
            Send text and files between your devices. No account, no storage.
          </p>
        </div>

        <div className="mt-10 w-full max-w-sm space-y-4 md:mt-14 md:max-w-md">
          {codeError && (
            <p className="animate-pop rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {codeError}
            </p>
          )}
          <CreateRoom onClick={onCreate} />
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              or join a room
            </span>
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
          <JoinRoom onSubmit={handleJoin} />
        </div>
      </main>
      <footer className="relative px-4 pb-6">
        <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500 md:text-sm">
          Text and files are transferred directly between connected devices when a
          peer-to-peer connection is available.
        </p>
        <button
          type="button"
          onClick={onOpenHowTo}
          className="mx-auto mt-4 flex items-center gap-1 text-sm font-semibold text-brand-blue underline decoration-brand-blue/40 underline-offset-4 transition hover:text-brand-dark-blue hover:decoration-brand-blue active:scale-[0.98] dark:text-brand-light-blue dark:decoration-brand-light-blue/40 dark:hover:text-brand-blue"
        >
          How to use
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </footer>
    </div>
  );
}