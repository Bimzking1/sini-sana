interface CreateRoomProps {
  onClick: () => void;
}

export default function CreateRoom({ onClick }: CreateRoomProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col items-center rounded-3xl bg-gradient-to-br from-brand-blue to-brand-light-blue px-6 py-7 font-display text-white shadow-sm shadow-brand-blue/20 transition hover:-translate-y-0.5 hover:from-brand-dark-blue hover:to-brand-blue hover:shadow-lg hover:shadow-brand-blue/30 active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 md:py-9"
    >
      <span className="text-lg font-bold md:text-xl">Create Room</span>
      <span className="mt-1.5 text-sm text-white/85 transition-colors group-hover:text-white">
        Get a shareable code and QR code
      </span>
    </button>
  );
}