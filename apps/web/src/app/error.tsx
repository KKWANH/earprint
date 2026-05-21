"use client";

/** Route-level error boundary — catches render/runtime errors in a page. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-sm text-neutral-400">
        An unexpected error occurred. This is usually temporary — please try again.
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
      >
        Try again
      </button>
    </main>
  );
}
