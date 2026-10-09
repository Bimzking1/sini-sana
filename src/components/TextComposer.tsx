import { useMemo, useRef, useState } from "react";
import { useClipboard } from "../hooks/useClipboard";

interface TextComposerProps {
  onSend: (content: string) => void;
  disabled: boolean;
  onNotice: (message: string) => void;
}

export default function TextComposer({ onSend, disabled, onNotice }: TextComposerProps) {
  const [value, setValue] = useState("");
  const { paste, error: pasteError } = useClipboard();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCoarsePointer = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches,
    [],
  );

  const send = (): void => {
    const content = value.trim();
    if (content.length === 0 || disabled) return;
    onSend(content);
    setValue("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      if (isCoarsePointer || event.nativeEvent.isComposing) return;
      event.preventDefault();
      send();
    }
  };

  const pasteFromClipboard = async (): Promise<void> => {
    const text = await paste();
    if (text !== null) {
      setValue((current) => (current.length === 0 ? text : `${current}\n${text}`));
    } else if (pasteError) {
      onNotice(pasteError);
    }
  };

  return (
    <div className="animate-fade-up rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste or type something…"
        rows={3}
        className="w-full resize-none rounded-t-3xl border-0 bg-transparent px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 dark:text-slate-100 dark:placeholder:text-slate-500 md:px-5 md:py-4 md:text-base"
      />
      <div className="flex items-center justify-between gap-2 px-3 pb-3 md:px-4 md:pb-4">
        <button
          type="button"
          onClick={pasteFromClipboard}
          className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          Paste from clipboard
        </button>
        <button
          type="button"
          onClick={send}
          disabled={disabled || value.trim().length === 0}
          className="rounded-xl bg-gradient-to-r from-brand-blue to-brand-light-blue px-6 py-2.5 font-display text-sm font-semibold text-white shadow-sm transition hover:from-brand-dark-blue hover:to-brand-blue active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 md:px-7 md:text-base"
        >
          Send
        </button>
      </div>
    </div>
  );
}