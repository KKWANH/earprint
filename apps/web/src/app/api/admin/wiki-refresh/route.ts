import { z } from "zod";
import { auth } from "@/auth";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { isAdminEmail } from "@/lib/constants";
import { loadWikiSummary } from "@/lib/wikipedia";

/**
 * POST /api/admin/wiki-refresh
 *
 * Admin-only manual cache invalidator for the Wikipedia summary
 * cache. Two modes:
 *
 *   { genre: "k-pop" }  → resets wiki_fetched_at to NULL for that
 *                         genre, then calls loadWikiSummary() which
 *                         re-fetches both languages. Returns the
 *                         fresh summary.
 *   { genre: "*" }      → bulk-clear: sets wiki_fetched_at = NULL
 *                         for ALL genre_info rows. Doesn't re-fetch
 *                         — the next /genre/[name] visit re-warms.
 *                         Useful when Wikipedia content updates en
 *                         masse (e.g. major editorial pass).
 *
 * Restricted to ADMIN_EMAILS. R34.
 */
const Body = z.object({
  genre: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return json({ error: "forbidden" }, 403);
  }
  const parsed = await readJsonBody<unknown>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);
  const target = v.data.genre.toLowerCase().trim();

  const sql = getSql();
  if (target === "*") {
    try {
      const r = await sql`
        UPDATE genre_info SET wiki_fetched_at = NULL
        WHERE wiki_fetched_at IS NOT NULL
        RETURNING genre`;
      return json({ ok: true, cleared: r.length }, 200);
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
  }

  // Single genre: clear timestamp then re-fetch immediately.
  try {
    await sql`
      UPDATE genre_info SET wiki_fetched_at = NULL
      WHERE genre = ${target}`;
    const summary = await loadWikiSummary(target);
    return json({ ok: true, genre: target, summary }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
}
