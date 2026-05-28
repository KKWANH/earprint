import { getSql } from "./db";

/**
 * Aggregates used by the worldcup home "사람들 통계" strip + the
 * trending row. All queries hit the existing `community_worldcups` +
 * `community_worldcup_items` tables — no schema changes — so we can
 * surface community activity without waiting on a finishes-log
 * migration.
 *
 * Every query is independently try/catch'd so a missing table on a
 * fresh deploy degrades to "no stats / no trending" instead of 500'ing
 * the worldcup home. Same defensive pattern the rest of /worldcup
 * already uses.
 */

export interface CommunityStats {
  totalWorldcups: number;
  totalPlays: number;
  /** Plays in the last 7 days. Computed from
   *  community_worldcup_finishes (R24d). Null when that table doesn't
   *  exist on this deploy yet — the bar then just omits the
   *  "this week" segment instead of pretending it's zero. */
  playsThisWeek: number | null;
  /** Items that won the most championships across ALL brackets. */
  topChampions: {
    title: string;
    subtitle: string | null;
    thumbnailUrl: string | null;
    championCount: number;
    worldcupId: string;
  }[];
  /** Users whose worldcups have the most total plays. Aggregated
   *  from community_worldcups.play_count grouped by owner_user_id;
   *  doesn't depend on the finishes table. */
  topCreators: {
    /** Public-display label — email local-part by default (kwanho0096
     *  → "kwanho0096"). Truncated upstream to ~12 chars. */
    handle: string;
    worldcupCount: number;
    totalPlays: number;
  }[];
}

export interface TrendingBracket {
  id: string;
  title: string;
  description: string | null;
  playCount: number;
  itemCount: number;
  /** Up to 4 item thumbnails to render as a small collage. */
  previews: { thumbnailUrl: string | null; title: string }[];
}

/**
 * Loads up to N of the signed-in user's own community worldcups —
 * surfaced on /worldcup home as a "📌 내가 만든" strip so creators
 * can see their own catalogue at a glance without navigating to
 * /u/<handle>. Returns [] when the user has no worldcups or no auth.
 */
export async function loadMyWorldcups(
  userId: string | null,
  limit = 4,
): Promise<TrendingBracket[]> {
  if (!userId) return [];
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT w.id::text AS id, w.title, w.description,
             w.play_count AS "playCount",
             (SELECT count(*)::int FROM community_worldcup_items i
                WHERE i.worldcup_id = w.id) AS "itemCount"
      FROM community_worldcups w
      WHERE w.owner_user_id = ${userId}::uuid
      ORDER BY w.created_at DESC
      LIMIT ${limit}`;
    return await Promise.all(
      rows.map(async (r) => {
        let previews: TrendingBracket["previews"] = [];
        try {
          const itemRows = await sql`
            SELECT thumbnail_url AS "thumbnailUrl", title
            FROM community_worldcup_items
            WHERE worldcup_id = ${r.id}::uuid
            ORDER BY position ASC
            LIMIT 4`;
          previews = itemRows.map((it) => ({
            thumbnailUrl: (it.thumbnailUrl as string | null) ?? null,
            title: it.title as string,
          }));
        } catch {
          /* leave empty */
        }
        return {
          id: r.id as string,
          title: r.title as string,
          description: (r.description as string | null) ?? null,
          playCount: Number(r.playCount ?? 0),
          itemCount: Number(r.itemCount ?? 0),
          previews,
        };
      }),
    );
  } catch (e) {
    console.error("[community-stats] loadMyWorldcups failed:", e);
    return [];
  }
}

/**
 * Two-row data for /worldcup home. We don't paginate — the trending
 * strip shows exactly 3 brackets (so the layout stays a single row at
 * sm:grid-cols-3) and the stats strip is a single inline line.
 */
export async function loadCommunityHomeData(): Promise<{
  stats: CommunityStats | null;
  trending: TrendingBracket[];
}> {
  const sql = getSql();

  // ── Aggregate stats ──────────────────────────────────────────────
  let totalWorldcups = 0;
  let totalPlays = 0;
  let topChampions: CommunityStats["topChampions"] = [];
  try {
    const rows = await sql`
      SELECT count(*)::int AS n, coalesce(sum(play_count), 0)::int AS plays
      FROM community_worldcups
      WHERE visibility = 'public'`;
    totalWorldcups = (rows[0]?.n as number) ?? 0;
    totalPlays = (rows[0]?.plays as number) ?? 0;
  } catch (e) {
    console.error("[community-stats] totals query failed:", e);
  }

  try {
    // Most-clicked champion items across the WHOLE platform. The join
    // back to community_worldcups filters out items belonging to
    // unlisted brackets — we only show what's discoverable. Items with
    // 0 champion_count get excluded so the list is meaningful on day 1
    // (fresh deploy with no plays returns []).
    const rows = await sql`
      SELECT i.title, i.subtitle, i.thumbnail_url AS "thumbnailUrl",
             i.champion_count AS "championCount",
             i.worldcup_id::text AS "worldcupId"
      FROM community_worldcup_items i
      JOIN community_worldcups w ON w.id = i.worldcup_id
      WHERE w.visibility = 'public' AND i.champion_count > 0
      ORDER BY i.champion_count DESC, i.win_count DESC
      LIMIT 3`;
    topChampions = rows.map((r) => ({
      title: r.title as string,
      subtitle: (r.subtitle as string | null) ?? null,
      thumbnailUrl: (r.thumbnailUrl as string | null) ?? null,
      championCount: Number(r.championCount ?? 0),
      worldcupId: r.worldcupId as string,
    }));
  } catch (e) {
    console.error("[community-stats] top champions query failed:", e);
  }

  // Plays in the last 7 days — independent table; degrades to null
  // (not 0) when the migration hasn't run, so the display layer can
  // distinguish "no recent plays" from "feature not yet available".
  let playsThisWeek: number | null = null;
  try {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM community_worldcup_finishes
      WHERE finished_at > now() - interval '7 days'`;
    playsThisWeek = Number((rows[0]?.n as number) ?? 0);
  } catch {
    /* finishes table not migrated yet — leave null */
  }

  // Top creators by total plays across their public worldcups. Email
  // local-part as the public handle (truncated). Excludes deleted-
  // user (NULL owner) rows. Bounded to 3 — we surface them as inline
  // chips, not a paginated leaderboard.
  let topCreators: CommunityStats["topCreators"] = [];
  try {
    const rows = await sql`
      SELECT u.email,
             count(*)::int AS "worldcupCount",
             coalesce(sum(w.play_count), 0)::int AS "totalPlays"
      FROM community_worldcups w
      JOIN users u ON u.id = w.owner_user_id
      WHERE w.visibility = 'public'
      GROUP BY u.id, u.email
      HAVING coalesce(sum(w.play_count), 0) > 0
      ORDER BY "totalPlays" DESC, "worldcupCount" DESC
      LIMIT 3`;
    topCreators = rows.map((r) => {
      const email = (r.email as string | null) ?? "";
      // Keep the handle short — the strip is space-constrained.
      // local-part only (drop @domain), then cap.
      const local = email.split("@")[0] ?? "";
      const handle = local.length > 14 ? `${local.slice(0, 13)}…` : local;
      return {
        handle: handle || "anon",
        worldcupCount: Number(r.worldcupCount ?? 0),
        totalPlays: Number(r.totalPlays ?? 0),
      };
    });
  } catch (e) {
    console.error("[community-stats] top creators query failed:", e);
  }

  const stats: CommunityStats | null =
    totalWorldcups > 0
      ? { totalWorldcups, totalPlays, playsThisWeek, topChampions, topCreators }
      : null;

  // ── Trending brackets (mirror the /community?sort=trending logic) ─
  // plays-per-day-since-creation. Newer brackets with traction surface
  // above old long-tail favourites, matching what the community list
  // tab already does so users see consistent ranking.
  let trending: TrendingBracket[] = [];
  try {
    const rows = await sql`
      SELECT w.id::text AS id, w.title, w.description, w.play_count AS "playCount",
             (SELECT count(*)::int FROM community_worldcup_items i
                WHERE i.worldcup_id = w.id) AS "itemCount"
      FROM community_worldcups w
      WHERE w.visibility = 'public'
      ORDER BY (w.play_count::real /
                  greatest(1, extract(epoch from (now() - w.created_at)) / 86400.0)) DESC,
               w.created_at DESC
      LIMIT 3`;
    // Fetch first 4 item thumbnails for each bracket — one extra
    // query per bracket but trending is capped at 3 so worst case 3
    // sub-queries. Cheap. Acceptable.
    trending = await Promise.all(
      rows.map(async (r) => {
        let previews: TrendingBracket["previews"] = [];
        try {
          const itemRows = await sql`
            SELECT thumbnail_url AS "thumbnailUrl", title
            FROM community_worldcup_items
            WHERE worldcup_id = ${r.id}::uuid
            ORDER BY position ASC
            LIMIT 4`;
          previews = itemRows.map((it) => ({
            thumbnailUrl: (it.thumbnailUrl as string | null) ?? null,
            title: it.title as string,
          }));
        } catch {
          /* leave empty — bracket card still renders */
        }
        return {
          id: r.id as string,
          title: r.title as string,
          description: (r.description as string | null) ?? null,
          playCount: Number(r.playCount ?? 0),
          itemCount: Number(r.itemCount ?? 0),
          previews,
        };
      }),
    );
  } catch (e) {
    console.error("[community-stats] trending query failed:", e);
  }

  return { stats, trending };
}
