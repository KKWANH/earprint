import type { MetadataRoute } from "next";
import { getSql } from "@/lib/db";
import { GENRE_CONTENT } from "@/data/genre-content";

/**
 * Sitemap for the publicly-indexable surface of Earprint.
 *
 * Authenticated routes (/library, /profile, /dna, /map, /recommend,
 * /connect, /account) are deliberately excluded — they show per-user
 * data and Google indexing them would either fail (302 to sign-in)
 * or, in the worst case, surface a real user's snapshot.
 *
 * Share pages (/s/<id>) are also excluded: they're public per the
 * user's own action, but we don't want them aggregated into a public
 * "browse other people's taste" surface. If a user wants their share
 * page indexed they paste the URL where it belongs.
 *
 * Now (R29a) also includes dynamic content:
 *   - Top 100 community worldcups by play_count
 *   - All creator profiles (/u/<handle>) — derived from the worldcup
 *     owners (no orphan user pages)
 *   - All curated genre pages (entries in genre-content.ts)
 * Each block is wrapped in try/catch so a missing table or schema
 * issue degrades to the static list rather than failing sitemap
 * generation entirely.
 */
// Force runtime evaluation — the sitemap now queries the DB to pull
// the top community worldcups + creator handles. Static export at
// build time would fail because DATABASE_URL is a deploy secret,
// not a build env var. Cloudflare serves the route per-request,
// which is cheap thanks to the LIMIT 100 + LIMIT 200 caps.
export const dynamic = "force-dynamic";

const ORIGIN = "https://earprint.kwanho.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const sql = getSql();
  const out: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${ORIGIN}/demo`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${ORIGIN}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${ORIGIN}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ORIGIN}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${ORIGIN}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${ORIGIN}/security`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${ORIGIN}/genres`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${ORIGIN}/worldcup/community`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
  ];

  // Curated genre pages — every entry in GENRE_CONTENT gets a sitemap
  // row. Long-tail genres (no curated content, fall back to AboutBox
  // only) are skipped to avoid feeding Google a thin tag soup; once
  // a genre has hand-written history it's worth surfacing.
  for (const key of Object.keys(GENRE_CONTENT)) {
    out.push({
      url: `${ORIGIN}/genre/${encodeURIComponent(key)}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Community worldcups + creators. Wrapped per-section so a fresh
  // deploy without the community tables still serves the static rows.
  try {
    const worldcups = await sql`
      SELECT id::text AS id, created_at, play_count
      FROM community_worldcups
      WHERE visibility = 'public'
      ORDER BY play_count DESC, created_at DESC
      LIMIT 100`;
    for (const w of worldcups) {
      out.push({
        url: `${ORIGIN}/worldcup/community/${w.id}`,
        lastModified: new Date(w.created_at as string),
        changeFrequency: "weekly",
        priority: Math.min(0.85, 0.6 + Math.log10(1 + Number(w.play_count ?? 0)) / 10),
      });
    }
  } catch {
    /* community tables not migrated — skip */
  }

  // Creator profiles. Pull distinct owner emails (via JOIN) and emit
  // /u/<handle> for each. Capped at 200 so a popular creator wave
  // doesn't bloat the sitemap to the 50k row limit.
  try {
    const creators = await sql`
      SELECT DISTINCT lower(split_part(u.email, '@', 1)) AS handle
      FROM community_worldcups w
      JOIN users u ON u.id = w.owner_user_id
      WHERE w.visibility = 'public'
      LIMIT 200`;
    for (const c of creators) {
      const handle = (c.handle as string | null) ?? "";
      if (handle && /^[a-z0-9._-]{1,30}$/.test(handle)) {
        out.push({
          url: `${ORIGIN}/u/${encodeURIComponent(handle)}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    }
  } catch {
    /* skip */
  }

  return out;
}
