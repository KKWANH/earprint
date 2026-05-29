import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getSql } from "@/lib/db";
import { isAdminEmail } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Background jobs — Earprint admin",
  robots: { index: false, follow: false },
};

interface JobRow {
  user_id: string;
  user_email: string | null;
  kind: string;
  status: string;
  updated_at: string;
  locked_until: string | null;
  notified_at: string | null;
  /** total user_tracks for this user — context for what the worker is going to process. */
  trackCount: number;
  /** rows in `analysis` for this user's tracks — the higher this is vs trackCount, the closer to "done". */
  analyzedCount: number;
}

/**
 * Admin view of services/analysis worker queue. Lists every
 * background_jobs row with status='running' first (the queue the
 * worker actually picks up), then the recently finished / stopped
 * ones below. Each row joins users → email so the admin can tell at
 * a glance who's being processed, and a quick aggregate of
 * user_tracks + analysis counts gives a sense of remaining work.
 *
 * No mutation actions — this is a monitor, not a control panel. To
 * cancel a job, manually UPDATE background_jobs SET status='stopped'
 * from a SQL console. To force an analysis rerun, use the genre
 * reanalysis admin path (R27e) which handles the cascade safely.
 *
 * Restricted to ADMIN_EMAILS. Any other user gets a notFound().
 */
export default async function JobsAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    notFound();
  }

  const sql = getSql();
  let jobs: JobRow[] = [];
  try {
    const rows = await sql`
      SELECT j.user_id::text AS user_id,
             u.email AS user_email,
             j.kind, j.status, j.updated_at, j.locked_until, j.notified_at,
             (SELECT count(*)::int FROM user_tracks ut
                WHERE ut.user_id = j.user_id) AS "trackCount",
             (SELECT count(*)::int FROM analysis a
                JOIN user_tracks ut ON ut.track_id = a.track_id
                WHERE ut.user_id = j.user_id
                  AND a.analysis_version = 1) AS "analyzedCount"
      FROM background_jobs j
      LEFT JOIN users u ON u.id = j.user_id
      ORDER BY (j.status = 'running') DESC, j.updated_at DESC
      LIMIT 100`;
    jobs = rows.map((r) => ({
      user_id: r.user_id as string,
      user_email: (r.user_email as string | null) ?? null,
      kind: r.kind as string,
      status: r.status as string,
      updated_at: new Date(r.updated_at as string).toISOString(),
      locked_until: r.locked_until
        ? new Date(r.locked_until as string).toISOString()
        : null,
      notified_at: r.notified_at
        ? new Date(r.notified_at as string).toISOString()
        : null,
      trackCount: Number(r.trackCount ?? 0),
      analyzedCount: Number(r.analyzedCount ?? 0),
    }));
  } catch {
    /* schema not migrated — empty list */
  }

  const running = jobs.filter((j) => j.status === "running");
  const other = jobs.filter((j) => j.status !== "running");

  // Aggregate stats for the header
  const totalRunning = running.length;
  const totalLocked = running.filter((j) => {
    if (!j.locked_until) return false;
    return new Date(j.locked_until).getTime() > Date.now();
  }).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Background jobs</h1>
          <p className="text-xs text-neutral-500">
            services/analysis worker queue (polls every ~1 min)
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
            {totalRunning} running
          </span>
          {totalLocked > 0 && (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
              {totalLocked} locked (worker active)
            </span>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Running
        </h2>
        {running.length === 0 ? (
          <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
            Queue is empty.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {running.map((j) => {
              const lockActive =
                j.locked_until &&
                new Date(j.locked_until).getTime() > Date.now();
              const remaining = j.trackCount - j.analyzedCount;
              const pct = j.trackCount > 0
                ? Math.round((j.analyzedCount / j.trackCount) * 100)
                : 0;
              return (
                <li
                  key={`${j.user_id}-${j.kind}`}
                  className={`rounded-2xl border p-4 ${
                    lockActive
                      ? "border-amber-500/30 bg-amber-950/15"
                      : "border-emerald-500/30 bg-emerald-950/15"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline gap-2 text-xs">
                    <span className="rounded-full bg-white/10 px-2 py-0.5 font-semibold">
                      {j.kind}
                    </span>
                    <span className="font-mono text-neutral-400">
                      {j.user_email ?? `${j.user_id.slice(0, 8)}…`}
                    </span>
                    {lockActive && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">
                        🔒 locked until{" "}
                        {new Date(j.locked_until!).toLocaleTimeString("ko-KR")}
                      </span>
                    )}
                    <span className="ml-auto text-neutral-600">
                      updated {new Date(j.updated_at).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-neutral-500">
                      {j.analyzedCount.toLocaleString()} /{" "}
                      {j.trackCount.toLocaleString()} · {remaining} left
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {other.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Recent (not running)
          </h2>
          <ul className="flex flex-col gap-1">
            {other.map((j) => (
              <li
                key={`${j.user_id}-${j.kind}`}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      j.status === "done"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : j.status === "stopped"
                          ? "bg-neutral-700/40 text-neutral-300"
                          : "bg-rose-500/15 text-rose-200"
                    }`}
                  >
                    {j.status}
                  </span>
                  <span className="text-neutral-400">{j.kind}</span>
                  <span className="font-mono text-neutral-500">
                    {j.user_email ?? `${j.user_id.slice(0, 8)}…`}
                  </span>
                  <span className="ml-auto text-neutral-600">
                    {new Date(j.updated_at).toLocaleString("ko-KR")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-neutral-600">
        Read-only. To cancel: SQL{" "}
        <code className="rounded bg-black/40 px-1 text-neutral-400">
          UPDATE background_jobs SET status=&apos;stopped&apos; WHERE
          user_id=…
        </code>
        . To rerun analysis for an artist, use{" "}
        <a href="/admin/genre-requests" className="text-emerald-300 hover:underline">
          genre-requests
        </a>{" "}
        (R27e).
      </p>
    </main>
  );
}
