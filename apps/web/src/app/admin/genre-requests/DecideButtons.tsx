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
      const d = (await res.json()) as {
        ok?: boolean;
        error?: string;
        reanalysisQueued?: boolean;
        reanalysisNuked?: number;
        createdGenreInfo?: boolean;
      };
      if (!res.ok || !d.ok) {
        setError(d.error ?? `HTTP ${res.status}`);
        setBusy(null);
        return;
      }
      // For accepted reanalysis: alert the admin so they can see the
      // side-effects happened. router.refresh() also surfaces the
      // new state, but the inline alert is more visceral for the
      // common "did anything actually happen?" question.
      if (d.reanalysisQueued || d.reanalysisNuked) {
        window.alert(
          `Reanalysis queued: nuked ${d.reanalysisNuked ?? 0} empty analysis rows for the requester.`,
        );
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
      {/* R27e: reanalysis accept now auto-queues a background_jobs
          row for the requester + nukes empty-genre analysis rows for
          tracks they have by the named artist. The services/analysis
          worker picks them up on its next poll (~1 min). */}
      {kind === "reanalysis" && (
        <span className="self-center text-[10px] text-emerald-300">
          Accept = auto-queue services/analysis rerun for the requester.
        </span>
      )}
      {error && (
        <span className="self-center text-rose-300">{error}</span>
      )}
    </div>
  );
}
