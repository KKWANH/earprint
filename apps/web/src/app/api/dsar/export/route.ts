import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";

/**
 * Data subject access request — GDPR Article 15 + 20 (data portability).
 *
 * Returns a single JSON document with everything the signed-in user has
 * stored in Earprint. Includes: account fields, plan / billing state,
 * synced tracks, AI analyses, AI profile (EN + KO), ratings, excluded
 * artists, affinity, share id. Deliberately excludes:
 *
 *   • password (we don't have one — Google OAuth)
 *   • Google access/refresh tokens (security risk to ship; they're per-
 *     session anyway and can be re-granted via /api/yt-oauth/start)
 *   • Lemon Squeezy raw webhook payloads (not user data, vendor traffic)
 *
 * The result is streamed as `application/json` with a Content-Disposition
 * header so browsers save it directly. No size guarantees but for a
 * 5,000-track library expect ~2-4 MB.
 */
export async function GET() {
  let userId: string;
  let email: string | null;
  try {
    const c = await ensureConnection();
    userId = c.userId;
    // Email comes from the session in ensureConnection — refetch the row
    // here to include the user-row fields the export needs.
    const sql = getSql();
    const u = await sql`SELECT email FROM users WHERE id = ${userId}`;
    email = (u[0]?.email as string) ?? null;
  } catch {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sql = getSql();
  const [
    user,
    tracks,
    profile,
    ratings,
    excluded,
    affinity,
  ] = await Promise.all([
    sql`
      SELECT id, email, display_name, created_at, updated_at, last_seen_at,
             tos_accepted_at, tos_version, age_confirmed_at, ai_consent_at,
             plan, plan_until, is_lifetime
      FROM users WHERE id = ${userId}`,
    sql`
      SELECT t.title, t.artist, t.album, t.deezer_id, t.mbid,
             ut.captured_at, ut.source,
             a.genres, a.moods, a.audio_feel
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
      WHERE ut.user_id = ${userId}
      ORDER BY ut.captured_at DESC`,
    sql`
      SELECT ai_profile_en, ai_profile_ko, ai_generated_at, ai_locale, share_id
      FROM taste_profiles WHERE user_id = ${userId}`,
    sql`
      SELECT artist, title, rating, comment, rec_type, created_at
      FROM recommendations
      WHERE user_id = ${userId} AND rating IS NOT NULL`,
    sql`SELECT artist FROM excluded_artists WHERE user_id = ${userId}`,
    sql`SELECT artist, weight, updated_at FROM artist_affinity WHERE user_id = ${userId}`,
  ]);

  const out = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    notice:
      "This is the complete personal data Earprint has stored about you. " +
      "If you import this elsewhere or share it publicly, you become the " +
      "controller of the copy.",
    account: user[0] ?? { email },
    syncedTracks: tracks,
    aiProfile: profile[0] ?? null,
    ratings,
    excludedArtists: excluded.map((r) => r.artist),
    artistAffinity: affinity,
  };

  const filename = `earprint-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(out, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
