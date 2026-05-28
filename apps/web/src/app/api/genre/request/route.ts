import { z } from "zod";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/**
 * POST /api/genre/request
 *
 * User-facing endpoint for the two-branch genre feedback form on
 * /genres:
 *
 *   kind='catalog'    — "Add genre X to the platform's tag catalogue."
 *                       The accept-handler writes a blank row into
 *                       genre_info, which then lazy-warms via
 *                       /api/genre/warm the next time someone visits.
 *
 *   kind='reanalysis' — "My liked tracks by artist Y have no genres
 *                       tagged." Accept is operator-action: rerun the
 *                       analysis pipeline for that artist's tracks.
 *
 * Rate-limited at 3 requests / user / day so a single user can't
 * spam the queue. The cap lives at the SQL level (count where
 * created_at > now() - interval) rather than an in-memory window so
 * a Cloudflare Worker cold start doesn't reset the budget.
 */
const Body = z.object({
  kind: z.enum(["catalog", "reanalysis"]),
  subject: z.string().trim().min(1).max(80),
  note: z.string().trim().max(500).optional(),
});

const DAILY_LIMIT = 3;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();

  const parsed = await readJsonBody<unknown>(req, 8 * 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);
  const { kind, subject, note } = v.data;

  const sql = getSql();
  // Per-user / per-day cap.
  try {
    const cap = await sql`
      SELECT count(*)::int AS n
      FROM genre_requests
      WHERE user_id = ${userId}
        AND created_at > now() - interval '24 hours'`;
    const submittedToday = (cap[0]?.n as number) ?? 0;
    if (submittedToday >= DAILY_LIMIT) {
      return json(
        {
          error: `daily limit (${DAILY_LIMIT}) reached — try again tomorrow`,
        },
        429,
      );
    }
  } catch {
    /* table might not exist yet on a half-migrated deploy — let the
       insert below fail explicitly with a clear error instead of
       silently swallowing the rate-limit check */
  }

  // De-dup with the same user's own recent (non-rejected) requests for
  // the same subject. Quietly succeed instead of inserting a second
  // row so a user double-clicking submit doesn't get charged twice
  // against their daily cap.
  const normalisedSubject = subject.toLowerCase();
  try {
    const dup = await sql`
      SELECT id::text AS id FROM genre_requests
      WHERE user_id = ${userId}
        AND kind = ${kind}
        AND lower(subject) = ${normalisedSubject}
        AND status IN ('pending', 'accepted')
      LIMIT 1`;
    if (dup.length > 0) {
      return json({ ok: true, id: dup[0]!.id as string, dedup: true }, 200);
    }
  } catch {
    /* fall through */
  }

  try {
    const rows = await sql`
      INSERT INTO genre_requests (user_id, kind, subject, note)
      VALUES (${userId}, ${kind}, ${normalisedSubject}, ${note ?? null})
      RETURNING id::text AS id`;
    return json({ ok: true, id: rows[0]?.id as string }, 200);
  } catch (e) {
    console.error("[genre-request] insert failed:", e);
    return json({ error: "couldn't save your request" }, 500);
  }
}
