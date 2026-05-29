import { z } from "zod";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/**
 * POST /api/genre/view — increments genre_views for one genre.
 *
 * Called once per session by <GenreViewPing> (R39, EC-3). Moving the
 * increment here from the server-rendered genre page means:
 *   - bots/crawlers (no JS) don't inflate the count
 *   - the client's sessionStorage guard dedups repeat visits
 *
 * No auth gate — view counts are anonymous + public. Genre name is
 * lower-cased + length-capped; the upsert is idempotent-ish (it
 * always bumps, but the caller only fires once/session).
 */
const Body = z.object({
  genre: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  const parsed = await readJsonBody<unknown>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid" }, 400);
  const genre = v.data.genre.toLowerCase().trim();

  const sql = getSql();
  try {
    await sql`
      INSERT INTO genre_views (genre, view_count)
      VALUES (${genre}, 1)
      ON CONFLICT (genre) DO UPDATE
        SET view_count = genre_views.view_count + 1,
            updated_at = now()`;
    return json({ ok: true }, 200);
  } catch {
    // Table not migrated / transient — non-fatal for a vanity metric.
    return json({ ok: false }, 200);
  }
}
