export default function Toast({ children }: { children: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-20 flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto animate-pop max-w-md rounded-full bg-slate-900/95 px-5 py-3 text-sm text-white shadow-lg shadow-slate-900/20 backdrop-blur dark:bg-slate-100/95 dark:text-slate-900 dark:shadow-black/20">
        {children}
      </div>
    </div>
  );
}