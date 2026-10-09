import { useRef, useState } from "react";
import { formatBytes } from "../lib/webrtc/progress";
import type { FileEntry } from "../lib/webrtc/fileTransfer";

interface FileDropzoneProps {
  onSend: (entries: FileEntry[]) => void;
  disabled: boolean;
  onNotice: (message: string) => void;
}

interface StagedFile {
  key: string;
  file: File;
  name: string;
}

export default function FileDropzone({ onSend, disabled, onNotice }: FileDropzoneProps) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: File[]): void => {
    const usable = files.filter((file) => file.size > 0);
    if (usable.length !== files.length) {
      onNotice("Skipped an empty file.");
    }
    if (usable.length === 0) return;
    setStaged((current) => [
      ...current,
      ...usable.map((file) => ({
        key: crypto.randomUUID(),
        file,
        name: file.name,
      })),
    ]);
  };

  const removeFile = (key: string): void => {
    setStaged((current) => current.filter((entry) => entry.key !== key));
  };

  const clearAll = (): void => {
    setStaged([]);
  };

  const sendAll = (): void => {
    if (staged.length === 0) return;
    onSend(
      staged.map((entry) => ({
        key: entry.key,
        file: entry.file,
        name: entry.name,
      })),
    );
    setStaged([]);
  };

  const openPicker = (): void => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(Array.from(event.target.files));
          event.target.value = "";
        }}
      />

      {staged.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") openPicker();
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files) addFiles(Array.from(event.dataTransfer.files));
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 py-10 text-center transition ${
            dragging
              ? "scale-[0.99] border-brand-blue bg-brand-light-blue/10 dark:bg-brand-blue/10"
              : "border-slate-300 bg-white hover:-translate-y-0.5 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500"
          }`}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 10V3m0 0L4.5 6.5M8 3l3.5 3.5M2.5 11v1.5A1.5 1.5 0 0 0 4 14h8a1.5 1.5 0 0 0 1.5-1.5V11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200 md:text-base">
            Drag files here
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 md:text-sm">or</p>
          <span className="mt-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-700 px-5 py-2.5 text-sm font-medium text-white transition group-hover:from-slate-800 dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
            Choose Files
          </span>
        </div>
      ) : (
        <div className="animate-pop rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="px-1 pb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {staged.length} file{staged.length === 1 ? "" : "s"} ready to fly
          </p>
          <ul className="max-h-44 space-y-1 overflow-y-auto">
            {staged.map((entry) => (
              <li
                key={entry.key}
                className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-100">
                  {entry.name}
                </span>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {formatBytes(entry.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(entry.key)}
                  aria-label={`Remove ${entry.name}`}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 4l8 8m0-8-8 8"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={sendAll}
              disabled={disabled}
              className="rounded-xl bg-gradient-to-r from-brand-blue to-brand-light-blue px-5 py-2.5 font-display text-sm font-semibold text-white shadow-sm transition hover:from-brand-dark-blue hover:to-brand-blue active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}