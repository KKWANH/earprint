import { getSql } from "./db";
import { getJson } from "./http";
import { searchDeezer } from "./deezer";

/** One recommendation candidate (input to save_recommendations). */
export interface RecRow {
  artist: string;
  title: string;
  album: string | null;
  deezerId: number | null;
  previewUrl: string | null;
  seedTrack: string;
}

const LASTFM = "https://ws.audioscrobbler.com/2.0/";

/** Last.fm similar tracks for a seed song. */
async function lastfmSimilar(
  artist: string,
  track: string,
): Promise<{ artist: string; title: string }[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  const data = await getJson(
    `${LASTFM}?method=track.getsimilar&autocorrect=1&format=json&limit=25` +
      `&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${key}`,
  );
  let t = data?.similartracks?.track;
  if (!t) return [];
  if (!Array.isArray(t)) t = [t];
  return t
    .map((x: any) => ({
      artist: String(x?.artist?.name ?? "").trim(),
      title: String(x?.name ?? "").trim(),
    }))
    .filter((x: { artist: string; title: string }) => x.artist && x.title);
}

/**
 * Liked-track seeds → Last.fm similar tracks → Deezer preview lookup.
 * Excludes already-liked / already-recommended / disliked artists (simple feedback loop).
 * Independent queries and the API loops run concurrently to stay within the
 * Cloudflare Workers per-request subrequest budget.
 */
export async function generateRecommendations(userId: string): Promise<RecRow[]> {
  const sql = getSql();

  const [seeds, likedRows, existingRows, dislikedRows] = await Promise.all([
    sql`
      SELECT t.artist, t.title
      FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId}
      ORDER BY random() LIMIT 4`,
    sql`
      SELECT DISTINCT lower(t.artist) AS a
      FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId}`,
    sql`
      SELECT lower(artist) || '|' || lower(title) AS k
      FROM recommendations WHERE user_id = ${userId}`,
    sql`
      SELECT DISTINCT lower(artist) AS a
      FROM recommendations WHERE user_id = ${userId} AND rating = 'dislike'`,
  ]);
  if (seeds.length === 0) return [];

  const likedArtists = new Set(likedRows.map((r) => r.a as string));
  const existing = new Set(existingRows.map((r) => r.k as string));
  const dislikedArtists = new Set(dislikedRows.map((r) => r.a as string));

  // Gather similar-track pools for all seeds concurrently.
  const simLists = await Promise.all(
    seeds.map((s) => lastfmSimilar(s.artist as string, s.title as string)),
  );
  const pool = simLists.flatMap((sims, i) =>
    sims.map((sim) => ({ ...sim, seedTrack: `${seeds[i].artist} - ${seeds[i].title}` })),
  );

  // Filter + de-duplicate down to 10 candidates.
  const picked: { artist: string; title: string; seedTrack: string }[] = [];
  const seen = new Set<string>();
  for (const c of pool) {
    const aL = c.artist.toLowerCase();
    const key = `${aL}|${c.title.toLowerCase()}`;
    if (likedArtists.has(aL) || dislikedArtists.has(aL)) continue;
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    picked.push(c);
    if (picked.length >= 10) break;
  }

  // Resolve Deezer previews concurrently; drop candidates with no playable preview.
  const matches = await Promise.all(picked.map((c) => searchDeezer(c.artist, c.title)));
  const rows: RecRow[] = [];
  picked.forEach((c, i) => {
    const d = matches[i];
    if (!d.previewUrl) return;
    rows.push({
      artist: c.artist,
      title: c.title,
      album: d.album,
      deezerId: d.deezerId,
      previewUrl: d.previewUrl,
      seedTrack: c.seedTrack,
    });
  });
  return rows;
}
