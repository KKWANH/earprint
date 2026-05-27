import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { captureError } from "@/lib/sentry";

/**
 * Lookup a YouTube videoId for a recommendation (artist + title) so the
 * Bracket UI can embed the actual video instead of just linking out to
 * search. Results are cached in `yt_search_cache` — both hits and misses —
 * so the same recommendation across users only burns the API quota once.
 *
 * Quota notes: YouTube Data API v3 charges 100 units per `search.list`
 * call and the default project quota is 10,000/day → 100 fresh searches.
 * Caching aggressively keeps us comfortably under that even with hundreds
 * of daily Bracket sessions. When the env var isn't set the endpoint
 * silently returns null so the UI falls back to the search link.
 */
// Per-user daily cap on FRESH YT searches. Cached lookups don't count
// against this — only ones that would actually hit Google's quota. Stops
// a single authenticated user from draining the global quota (100/day on
// the default key) in one bracket session of 20 unfamiliar tracks.
const YT_SEARCH_PER_USER_DAILY = 60;

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{ artist?: string; title?: string }>(
    req,
    1024,
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const artist = (body.artist ?? "").trim();
  const title = (body.title ?? "").trim();
  if (!artist || !title) return json({ error: "artist+title required" }, 400);

  const cacheKey = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  const sql = getSql();

  try {
    const hit = await sql`
      SELECT video_id FROM yt_search_cache WHERE cache_key = ${cacheKey}`;
    if (hit.length > 0) {
      return json({ videoId: (hit[0].video_id as string | null) ?? null }, 200);
    }
  } catch (e) {
    // Cache outage → live lookup. Don't bail.
    captureError(e, { tag: "yt-search.cache-read" });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    // Without a key we can't search. Return null so the bracket card
    // falls back to its YouTube search link.
    return json({ videoId: null, reason: "no-key" }, 200);
  }

  // Per-user daily quota check before we burn a real Google search.
  // user_usage carries the same counter pattern as the global Gemini cap.
  try {
    const counter = await sql`
      SELECT count FROM user_usage
       WHERE user_id = ${userId} AND kind = 'yt-search'
         AND usage_date = current_date`;
    const today = counter.length > 0 ? (counter[0].count as number) : 0;
    if (today >= YT_SEARCH_PER_USER_DAILY) {
      return json({ videoId: null, reason: "user-quota" }, 200);
    }
    // Increment optimistically — a duplicate request races by ≤1.
    await sql`
      INSERT INTO user_usage (user_id, kind, usage_date, count)
      VALUES (${userId}, 'yt-search', current_date, 1)
      ON CONFLICT (user_id, kind, usage_date)
      DO UPDATE SET count = user_usage.count + 1`;
  } catch (e) {
    // Counter outage shouldn't block the call.
    captureError(e, { tag: "yt-search.quota-counter" });
  }

  let videoId: string | null = null;
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${q}&key=${apiKey}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (r.ok) {
      const data = (await r.json()) as {
        items?: Array<{ id?: { videoId?: string } }>;
      };
      const id = data.items?.[0]?.id?.videoId;
      if (typeof id === "string" && id.length > 0) videoId = id;
    } else if (r.status === 403) {
      // Quota exhausted — don't cache the negative result; tomorrow's
      // quota reset should work for the same query.
      captureError(new Error(`yt quota: ${r.status}`), {
        tag: "yt-search.quota",
        extra: { artist, title },
      });
      return json({ videoId: null, reason: "quota" }, 200);
    }
  } catch (e) {
    captureError(e, { tag: "yt-search.fetch", extra: { artist, title } });
    return json({ videoId: null, reason: "fetch-failed" }, 200);
  }

  try {
    await sql`
      INSERT INTO yt_search_cache (cache_key, video_id)
      VALUES (${cacheKey}, ${videoId})
      ON CONFLICT (cache_key) DO NOTHING`;
  } catch (e) {
    captureError(e, { tag: "yt-search.cache-write" });
  }
  return json({ videoId }, 200);
}
