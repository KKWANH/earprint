/** Map-shaped skeleton — the artist map can take a moment on the first load. */
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-1.5 h-3 w-64 animate-pulse rounded bg-white/5" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-20 w-20 animate-pulse rounded-full bg-white/10" />
      </div>
    </main>
  );
}
