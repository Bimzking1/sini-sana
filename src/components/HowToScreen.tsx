import type { ReactNode } from "react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

interface HowToScreenProps {
  onBack: () => void;
}

export default function HowToScreen({ onBack }: HowToScreenProps) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 animate-float-slow rounded-full bg-brand-orange/20 blur-3xl dark:bg-brand-orange/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 animate-float-slow rounded-full bg-brand-light-blue/20 blur-3xl [animation-delay:2s] dark:bg-brand-blue/10"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-1/4 h-72 w-72 animate-float-slow rounded-full bg-brand-blue/15 blur-3xl [animation-delay:4s] dark:bg-brand-blue/10"
      />

      <div className="absolute left-4 top-4 z-10 md:left-6 md:top-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98] dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3.5 5.5 8l4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
      </div>
      <div className="absolute right-4 top-4 z-10 md:right-6 md:top-6">
        <ThemeToggle />
      </div>

      <main className="relative flex flex-1 flex-col items-center px-4 py-12 md:py-16">
        <div className="flex flex-col items-center text-center">
          <Logo size={46} className="md:h-14 md:w-14" />
          <h1 className="mt-4 bg-gradient-to-r from-brand-light-orange via-brand-orange to-brand-blue bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-5xl">
            How Sini Sana works
          </h1>
          <p className="mt-2 max-w-md text-base text-slate-600 dark:text-slate-400 md:text-lg">
            A tiny guide, with absolutely zero boring parts.
          </p>
        </div>

        <ol className="mt-10 w-full max-w-xl space-y-4 md:space-y-5">
          <Step
            number={1}
            gradient="from-brand-orange to-brand-light-orange"
            delay="0ms"
            title="Create a room"
            icon={
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 2.2v11.6M2.2 8h11.6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
              </svg>
            }
          >
            Tap <span className="font-semibold text-slate-800 dark:text-slate-100">Create Room</span> and we
            instantly cook up a secret room code plus a QR code — your very own doorway.
          </Step>
          <Step
            number={2}
            gradient="from-brand-dark-blue to-brand-light-blue"
            delay="100ms"
            title="Share the magic"
            icon={
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2.5" y="2.5" width="4" height="4" rx="0.8" fill="currentColor" />
                <rect x="9.5" y="2.5" width="4" height="4" rx="0.8" fill="currentColor" />
                <rect x="2.5" y="9.5" width="4" height="4" rx="0.8" fill="currentColor" />
                <rect x="9.5" y="9.5" width="2.6" height="2.6" rx="0.6" fill="currentColor" />
                <rect x="10.9" y="10.9" width="1.5" height="1.5" rx="0.5" fill="currentColor" />
                <rect x="14" y="12" width="0" height="0" fill="currentColor" />
                <rect x="12" y="14" width="1.5" height="1.5" rx="0.5" fill="currentColor" opacity="0" />
                <path d="M13.5 12.5v.5a1 1 0 0 1-1 1h-.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            }
          >
            Scan the QR with your phone, or share the code and link with a friend anywhere on Earth.
            Same room, both sides — no login, no playlist of permissions.
          </Step>
          <Step
            number={3}
            gradient="from-brand-orange to-brand-blue"
            delay="200ms"
            title="High-five to connect"
            icon={
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M9 1.8 3.4 9h3.6l-.8 5.2L12 7H8.6L9 1.8Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
              </svg>
            }
          >
            The moment someone joins, your devices find each other and do a WebRTC high-five.
            When you see <span className="font-semibold text-brand-blue dark:text-brand-light-blue">Connected</span>,
            you're ready to go.
          </Step>
          <Step
            number={4}
            gradient="from-brand-light-blue to-brand-blue"
            delay="300ms"
            title="Send whatever you like"
            icon={
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M2.5 8 13 2.8 8.4 13.2 7.5 9 2.5 8Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <path d="M7.6 9 13 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            }
          >
            Type a note, paste from your clipboard, or drag in photos and files. Everything flies
            straight between the two devices — it never waits in a cloud.
          </Step>
        </ol>

        <div className="relative mt-8 w-full max-w-xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-orange to-brand-blue p-6 text-center shadow-lg shadow-brand-orange/20 md:p-8">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 animate-float-slow rounded-full bg-white/15 blur-2xl"
          />
          <svg
            className="mx-auto text-white/60"
            width="22"
            height="22"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 1.6c.7 3.4 2.9 5.6 6.4 6.4-3.5.8-5.7 3-6.4 6.4C7.3 11 5.1 8.8 1.6 8 5.1 7.2 7.3 5 8 1.6Z"
              fill="currentColor"
            />
          </svg>
          <p className="relative mt-2 text-base font-medium text-white md:text-lg">
            "Like passing a note across the room — except the room is the whole planet."
          </p>
        </div>

        <div className="mt-6 grid w-full max-w-xl gap-3 sm:grid-cols-3">
          <FeatureCard
            icon={
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M2.6 13.5c.5-3 2-4.5 5.4-4.5s4.9 1.5 5.4 4.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            }
            title="No account"
          >
            No sign-ups, no passwords. Just show up.
          </FeatureCard>
          <FeatureCard
            icon={
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M3.5 7a3 3 0 0 1 1-5.8 4.5 4.5 0 0 1 8.4 2A3.6 3.6 0 0 1 12.5 13H5A3.5 3.5 0 0 1 3.5 7Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                />
                <path d="M3 13 13 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
            title="No cloud"
          >
            Files go device-to-device, never through us.
          </FeatureCard>
          <FeatureCard
            icon={
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="6.5"
                  width="10"
                  height="8"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M5.5 6.5V4.8a2.5 2.5 0 0 1 5 0v1.7"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="10.2" r="1.1" fill="currentColor" />
              </svg>
            }
            title="Private"
          >
            What you send stays between your devices.
          </FeatureCard>
        </div>

        <div className="mt-10 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl bg-gradient-to-r from-brand-blue to-brand-light-blue px-8 py-3.5 font-display text-sm font-bold text-white shadow-lg shadow-brand-blue/25 transition hover:-translate-y-0.5 hover:from-brand-dark-blue hover:to-brand-blue active:translate-y-0 active:scale-[0.98] md:text-base"
          >
            Got it — let's go
          </button>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Rooms quietly disappear after about 2 hours. Use them while they're hot.
          </p>
        </div>
      </main>
    </div>
  );
}

interface StepProps {
  number: number;
  gradient: string;
  delay: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

function Step({ number, gradient, delay, title, icon, children }: StepProps) {
  return (
    <li
      className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 md:p-6"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white shadow-sm`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Step {number}
          </p>
          <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white md:text-lg">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
            {children}
          </p>
        </div>
      </div>
    </li>
  );
}

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

function FeatureCard({ icon, title, children }: FeatureCardProps) {
  return (
    <div className="animate-fade-up rounded-3xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-light-blue/10 text-brand-blue dark:bg-brand-blue/10 dark:text-brand-light-blue">
        {icon}
      </span>
      <h3 className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{children}</p>
    </div>
  );
}