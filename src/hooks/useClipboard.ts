import { useCallback, useState } from "react";

export interface ClipboardResult {
  copy: (text: string) => Promise<boolean>;
  /** Reads text from the clipboard, or returns null when permission is denied. */
  paste: () => Promise<string | null>;
  error: string | null;
}

/** Clipboard helpers that degrade gracefully when permissions are denied. */
export function useClipboard(): ClipboardResult {
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    setError(null);
    if (!navigator.clipboard?.writeText) {
      setError("Clipboard isn't available in this browser.");
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      setError("Clipboard access was denied by the browser.");
      return false;
    }
  }, []);

  const paste = useCallback(async (): Promise<string | null> => {
    setError(null);
    if (!navigator.clipboard?.readText) {
      setError("Clipboard isn't available in this browser.");
      return null;
    }
    try {
      return await navigator.clipboard.readText();
    } catch {
      setError("Clipboard access was denied by the browser.");
      return null;
    }
  }, []);

  return { copy, paste, error };
}