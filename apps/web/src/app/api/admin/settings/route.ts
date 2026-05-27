import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { ADMIN_EMAILS, isAdminEmail } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/**
 * Admin settings endpoint. Currently exposes a single tuning knob: the
 * recency α curve used by topArtists / topTags / recommend seeds.
 *
 * GET                  → current α + top-5 preview at that α (admin's own
 *                        library)
 * GET ?alpha=X         → top-5 preview at the requested α, without saving
 * POST { alpha: X }    → set recency_alpha in app_settings
 *
 * Auth: gated by `isAdminEmail()`. Non-admin requests get 403 even when
 * authenticated, so a forgotten button click can't expose this surface.
 * ADMIN_EMAILS is intentionally short — anyone in it can change tuning
 * that affects every user's library results.
 */

async function ensureAdmin(): Promise<string | Response> {
  try {
    const session = await auth();
    const email = session?.user?.email;
    if (!isAdminEmail(email)) {
      return json({ error: "forbidden" }, 403);
    }
    return email!;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
}

/** Top 5 artists for the *admin's own* library at an arbitrary α —
 *  useful preview while sliding before saving the value globally. */
async function topArtistsAtAlpha(
  userId: string,
  alpha: number,
): Promise<{ name: string; count: number; score: number }[]> {
  const sql = getSql();
  const rows = await sql`
    WITH lib_size AS (
      SELECT count(*)::int AS n FROM user_tracks WHERE user_id = ${userId}
    )
    SELECT artist_canon(t.artist, t.deezer_artist_id) AS name,
           count(*)::int AS count,
           sum(
             CASE
               WHEN ut.list_position IS NULL OR lib_size.n <= 0 THEN 1.0::real
               ELSE (1.0 + ${alpha}::real * greatest(0.0,
                       1.0 - ut.list_position::real / lib_size.n::real))::real
             END
           )::real AS score
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    CROSS JOIN lib_size
    WHERE ut.user_id = ${userId}
    GROUP BY artist_canon(t.artist, t.deezer_artist_id)
    ORDER BY score DESC
    LIMIT 5`;
  return rows.map((r) => ({
    name: r.name as string,
    count: r.count as number,
    score: r.score as number,
  }));
}

export async function GET(req: Request) {
  const admin = await ensureAdmin();
  if (typeof admin !== "string") return admin;
  const { userId } = await ensureConnection();

  const url = new URL(req.url);
  const previewParam = url.searchParams.get("alpha");
  if (previewParam != null) {
    const alpha = Math.max(0, Math.min(5, Number(previewParam) || 0));
    return json({ preview: await topArtistsAtAlpha(userId, alpha) }, 200);
  }

  const sql = getSql();
  const rows = await sql`SELECT recency_alpha FROM app_settings WHERE id = 1`;
  const alpha = (rows[0]?.recency_alpha as number) ?? 1.0;
  return json({
    alpha,
    preview: await topArtistsAtAlpha(userId, alpha),
    admins: ADMIN_EMAILS,
  }, 200);
}

export async function POST(req: Request) {
  const admin = await ensureAdmin();
  if (typeof admin !== "string") return admin;

  const parsed = await readJsonBody<{ alpha?: number }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const alpha = Math.max(0, Math.min(5, Number(body.alpha) || 0));

  const sql = getSql();
  await sql`UPDATE app_settings SET recency_alpha = ${alpha}, updated_at = now() WHERE id = 1`;
  return json({ ok: true, alpha }, 200);
}
