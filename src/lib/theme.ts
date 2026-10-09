export type Theme = "dark" | "light";

export const DEFAULT_THEME: Theme = "dark";

const STORAGE_KEY = "sinisana:theme";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage unavailable (private mode): keep the default.
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage unavailable; the class-only change still applies.
  }
}