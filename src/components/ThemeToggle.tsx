import { useTheme } from "../hooks/useTheme";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:rotate-12 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${className}`}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M2.6 2.6l1.1 1.1M12.3 12.3l1.1 1.1M13.4 2.6l-1.1 1.1M3.7 12.3l-1.1 1.1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13.5 8.6A5.5 5.5 0 0 1 7.4 2.5 5.5 5.5 0 1 0 13.5 8.6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}