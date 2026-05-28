"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Worldcup-scoped error boundary. Standalone from the root error.tsx so
 * worldcup-only failures don't show the generic "예상치 못한 오류"
 * screen — gives the user the route they were in, plus the digest the
 * operator needs to correlate against Cloudflare logs ("error.digest =
 * abc123" appears in production server logs alongside the stack).
 */
export default function WorldcupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[worldcup] server error", error);
    }
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-12 sm:px-6 sm:py-20">
      <h1 className="text-xl font-bold">월드컵 페이지 로드 실패</h1>
      <p className="text-sm text-neutral-400">
        서버에서 페이지를 그리는 중에 오류가 났습니다. 잠시 후 다시 시도하거나,
        같은 오류가 계속 나면 아래 코드와 함께 알려주세요.
      </p>
      {error.digest && (
        <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 font-mono text-xs text-rose-200">
          digest: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="rounded-md border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
