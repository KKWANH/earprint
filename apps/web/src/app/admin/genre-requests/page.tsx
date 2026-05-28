import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getSql } from "@/lib/db";
import { isAdminEmail } from "@/lib/constants";
import { DecideButtons } from "./DecideButtons";

export const metadata: Metadata = {
  title: "Genre requests — Earprint admin",
  robots: { index: false, follow: false },
};

interface RequestRow {
  id: string;
  kind: "catalog" | "reanalysis";
  subject: string;
  note: string | null;
  status: "pending" | "accepted" | "rejected" | "duplicate";
  created_at: string;
  user_email: string | null;
}

/**
 * Admin queue for /api/genre/request submissions. Lists the most
 * recent 100 requests (newest pending first), surfaces who submitted
 * and the note, and exposes Accept / Reject / Duplicate buttons that
 * post to the decide endpoint. Restricted to ADMIN_EMAILS — any other
 * user gets a notFound() (same as the rest of admin tooling).
 *
 * Accept-on-catalog inserts a blank genre_info row server-side; the
 * lazy-warm path on /genre/[name] then fills in the description on
 * first visit. Accept-on-reanalysis is operator-action — flipping the
 * status is the journal entry; rerun the analysis pipeline by hand.
 */
export default async function GenreRequestsAdmin() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    notFound();
  }

  const sql = getSql();
  let rows: RequestRow[] = [];
  try {
    const r = await sql`
      SELECT r.id::text AS id, r.kind, r.subject, r.note, r.status,
             r.created_at, u.email AS user_email
      FROM genre_requests r
      LEFT JOIN users u ON u.id = r.user_id
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC
      LIMIT 100`;
    rows = r.map((row) => ({
      id: row.id as string,
      kind: row.kind as RequestRow["kind"],
      subject: row.subject as string,
      note: (row.note as string | null) ?? null,
      status: row.status as RequestRow["status"],
      created_at: new Date(row.created_at as string).toISOString(),
      user_email: (row.user_email as string | null) ?? null,
    }));
  } catch {
    /* table not yet migrated — empty list */
  }

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Genre requests</h1>
        <span className="text-xs text-neutral-500">
          {pending.length} pending · {decided.length} decided
        </span>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Pending
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-md border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
            Queue is clear.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-amber-500/30 bg-amber-950/15 p-4"
              >
                <div className="flex flex-wrap items-baseline gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      r.kind === "catalog"
                        ? "bg-sky-500/20 text-sky-200"
                        : "bg-emerald-500/20 text-emerald-200"
                    }`}
                  >
                    {r.kind}
                  </span>
                  <span className="font-semibold text-white">{r.subject}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-neutral-500">
                    {r.user_email ?? "(deleted user)"}
                  </span>
                  <span className="text-neutral-600">
                    · {new Date(r.created_at).toLocaleString("ko-KR")}
                  </span>
                </div>
                {r.note && (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-neutral-300">
                    {r.note}
                  </p>
                )}
                <div className="mt-3">
                  <DecideButtons id={r.id} kind={r.kind} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Recent decisions
          </h2>
          <ul className="flex flex-col gap-1">
            {decided.map((r) => (
              <li
                key={r.id}
                className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold ${
                      r.status === "accepted"
                        ? "bg-emerald-500/15 text-emerald-200"
                        : r.status === "rejected"
                          ? "bg-rose-500/15 text-rose-200"
                          : "bg-neutral-700/40 text-neutral-300"
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-neutral-400">{r.kind}</span>
                  <span className="text-white">{r.subject}</span>
                  <span className="text-neutral-600">
                    · {r.user_email ?? "(deleted user)"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
