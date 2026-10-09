import type { TransferItem as TransferItemModel } from "../types/transfer";
import TransferItem from "./TransferItem";

interface TransferListProps {
  items: TransferItemModel[];
  onNotice: (message: string) => void;
}

function EmptyState() {
  return (
    <div className="animate-fade-up rounded-3xl border border-dashed border-slate-300 px-6 py-10 text-center dark:border-slate-700">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <svg width="26" height="26" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-4.5 6.5a4.5 4.5 0 0 1 9 0M9 10.5h2.5V13h-2.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400 md:text-base">
        Nothing sent yet
      </p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500 md:text-sm">
        Drop a note, a photo, or a whole folder — it all travels device-to-device.
      </p>
    </div>
  );
}

export default function TransferList({ items, onNotice }: TransferListProps) {
  if (items.length === 0) {
    return <EmptyState />;
  }
  return (
    <div className="space-y-2 md:space-y-3">
      {items.map((item) => (
        <TransferItem key={item.id} item={item} onNotice={onNotice} />
      ))}
    </div>
  );
}