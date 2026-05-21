import { getSql } from "./db";
import { getJson } from "./http";
import { searchDeezer } from "./deezer";

/** One recommendation candidate (input to save_recommendations). */
export interface RecRow {
  artist: string;
  title: string;
  album: string | null;
  coverUrl: string | null;
  deezerId: number | null;
  previewUrl: string | null;
  seedTrack: string;
  score: number | null;
  recType: "similar" | "explore";
}

const LASTFM = "https://ws.audioscrobbler.com/2.0/";

// Broad genres used to pull "exploration" picks from outside the usual taste.
const BROAD_GENRES = [
  "jazz", "classical", "hip hop", "electronic", "rock", "metal", "folk",
  "soul", "funk", "reggae", "country", "blues", "ambient", "punk",
  "r&b", "bossa nova", "disco", "indie rock",
];

interface SimilarTrack {
  artist: string;
  title: string;
  match: number;
}

/** Last.fm similar tracks for a seed song. */
async function lastfmSimilar(artist: string, track: string): Promise<SimilarTrack[]> {
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
      match: Math.max(0, Math.min(1, Number(x?.match ?? 0))),
    }))
    .filter((x: SimilarTrack) => x.artist && x.title);
}

/** Last.fm top tracks for a genre tag (used for exploration picks). */
async function tagTopTracks(tag: string): Promise<{ artist: string; title: string }[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  const data = await getJson(
    `${LASTFM}?method=tag.gettoptracks&format=json&limit=60` +
      `&tag=${encodeURIComponent(tag)}&api_key=${key}`,
  );
  let t = data?.tracks?.track;
  if (!t) return [];
  if (!Array.isArray(t)) t = [t];
  return t
    .map((x: any) => ({
      artist: String(x?.artist?.name ?? "").trim(),
      title: String(x?.name ?? "").trim(),
    }))
    .filter((x: { artist: string; title: string }) => x.artist && x.title);
}

function shuffle<T>(arr: T[]): T[] {
  return arr.map((v) => ({ v, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.v);
}

/**
 * Builds ~7 "similar" picks (Last.fm similar tracks) + ~3 "explore" picks
 * (top tracks of broad genres the user barely listens to) so recommendations
 * aren't all the same genre. Excludes already-liked/recommended/disliked artists.
 */
export async function generateRecommendations(userId: string): Promise<RecRow[]> {
  const sql = getSql();

  const [seeds, likedRows, existingRows, dislikedRows, genreRows] = await Promise.all([
    sql`
      SELECT t.artist, t.title
      FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId}
      ORDER BY random() LIMIT 5`,
    sql`
      SELECT DISTINCT lower(t.artist) AS a
      FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
      WHERE ut.user_id = ${userId}`,
    sql`
      SELECT lower(artist) || '|' || lower(title) AS k
      FROM recommendations WHERE user_id = ${userId}`,
    sql`
      SELECT DISTINCT lower(artist) AS a
      FROM recommendations
      WHERE user_id = ${userId} AND rating IN ('dislike', 'strong_dislike')`,
    sql`
      SELECT DISTINCT lower(k.key) AS g
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
      WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL`,
  ]);
  if (seeds.length === 0) return [];

  const likedArtists = new Set(likedRows.map((r) => r.a as string));
  const existing = new Set(existingRows.map((r) => r.k as string));
  const dislikedArtists = new Set(dislikedRows.map((r) => r.a as string));
  const userGenres = genreRows.map((r) => r.g as string);

  // "similar" pool — Last.fm similar tracks for every seed, best match first.
  const simLists = await Promise.all(
    seeds.map((s) => lastfmSimilar(s.artist as string, s.title as string)),
  );
  const simPool = simLists
    .flatMap((sims, i) =>
      sims.map((sim) => ({
        ...sim,
        seedTrack: `${seeds[i].artist} - ${seeds[i].title}`,
        recType: "similar" as const,
      })),
    )
    .sort((a, b) => b.match - a.match);

  // "explore" pool — broad genres the user barely has.
  const exploreGenres = shuffle(
    BROAD_GENRES.filter(
      (g) => !userGenres.some((ug) => ug.includes(g) || g.includes(ug)),
    ),
  ).slice(0, 2);
  const tagLists = await Promise.all(exploreGenres.map((g) => tagTopTracks(g)));
  const explorePool = tagLists.flatMap((tracks, i) =>
    shuffle(tracks).map((t) => ({
      artist: t.artist,
      title: t.title,
      match: 0,
      seedTrack: exploreGenres[i],
      recType: "explore" as const,
    })),
  );

  const seen = new Set<string>();
  function pick(pool: typeof simPool | typeof explorePool, limit: number) {
    const out: (typeof pool)[number][] = [];
    for (const c of pool) {
      const aL = c.artist.toLowerCase();
      const key = `${aL}|${c.title.toLowerCase()}`;
      if (likedArtists.has(aL) || dislikedArtists.has(aL)) continue;
      if (existing.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(c);
      if (out.length >= limit) break;
    }
    return out;
  }
  // Interleave so an "explore" pick lands roughly every 3rd card.
  const sim = pick(simPool, 7);
  const exp = pick(explorePool, 3);
  const picked: (typeof sim[number] | typeof exp[number])[] = [];
  let si = 0;
  let ei = 0;
  for (let i = 0; i < sim.length + exp.length; i++) {
    if ((i + 1) % 3 === 0 && ei < exp.length) picked.push(exp[ei++]);
    else if (si < sim.length) picked.push(sim[si++]);
    else if (ei < exp.length) picked.push(exp[ei++]);
  }

  // Resolve Deezer (cover, preview); drop candidates with no playable preview.
  const matches = await Promise.all(picked.map((c) => searchDeezer(c.artist, c.title)));
  const rows: RecRow[] = [];
  picked.forEach((c, i) => {
    const d = matches[i];
    if (!d.previewUrl) return;
    rows.push({
      artist: c.artist,
      title: c.title,
      album: d.album,
      coverUrl: d.coverUrl,
      deezerId: d.deezerId,
      previewUrl: d.previewUrl,
      seedTrack: c.seedTrack,
      score: c.recType === "similar" ? c.match : null,
      recType: c.recType,
    });
  });
  return rows;
}
