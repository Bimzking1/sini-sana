import { useCallback, useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "../lib/theme";

export interface UseThemeResult {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme): void => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback((): void => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, setTheme, toggleTheme };
}