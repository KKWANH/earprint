/** Pulsing placeholder shown while a page's server data loads. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl animate-pulse flex-col gap-4 px-4 py-8 sm:px-6 sm:py-12">
      <div className="h-7 w-48 rounded bg-white/10" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-28 rounded-xl bg-white/5" />
      ))}
    </div>
  );
}
