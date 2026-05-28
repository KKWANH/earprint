"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Three-button decision strip for the admin queue. Posts to
 * /api/admin/genre-requests/[id]/decide with the chosen decision,
 * then router.refresh() to re-render the server component with the
 * row moved into the "Recent decisions" tail section.
 *
 * For 'catalog' kind, the accept path also kicks off a genre_info
 * row server-side — this UI doesn't need to know about that, just
 * reflects the success.
 */
export function DecideButtons({
  id,
  kind,
}: {
  id: string;
  kind: "catalog" | "reanalysis";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "accepted" | "rejected" | "duplicate">(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "accepted" | "rejected" | "duplicate") {
    if (busy) return;
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/admin/genre-requests/${id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) {
        setError(d.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(String(e));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => decide("accepted")}
        className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === "accepted" ? "..." : "Accept"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => decide("rejected")}
        className="rounded-md border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-rose-200 hover:bg-rose-900/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === "rejected" ? "..." : "Reject"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => decide("duplicate")}
        className="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-neutral-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy === "duplicate" ? "..." : "Duplicate"}
      </button>
      {/* For reanalysis kind, accept is operator action — surface the
          reminder so the admin knows to actually rerun the pipeline. */}
      {kind === "reanalysis" && (
        <span className="self-center text-[10px] text-neutral-500">
          Accept = mark only. Rerun analysis via services/analysis.
        </span>
      )}
      {error && (
        <span className="self-center text-rose-300">{error}</span>
      )}
    </div>
  );
}
