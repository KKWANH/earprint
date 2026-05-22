import { getSql } from "./db";
import { getJson } from "./http";
import { searchDeezer } from "./deezer";

/** Recommendation flavour the user can choose. */
export type RecMode = "song" | "genre" | "unheard" | "indie" | "mix";

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
  recType: "song" | "genre" | "unheard" | "indie";
}

const LASTFM = "https://ws.audioscrobbler.com/2.0/";
const INDIE_MAX_RANK = 280_000; // Deezer rank below this ≈ a smaller / indie act

// Broad genres for the "unheard" mode — picks from outside the usual taste.
const BROAD_GENRES = [
  "jazz", "classical", "hip hop", "electronic", "rock", "metal", "folk",
  "soul", "funk", "reggae", "country", "blues", "ambient", "punk",
  "r&b", "bossa nova", "disco", "indie rock", "shoegaze", "city pop",
];

interface Cand {
  artist: string;
  title: string;
  match: number;
  seedTrack: string;
  recType: RecRow["recType"];
}

/**
 * Runs a Last.fm fetch through a shared DB cache. Similar tracks / genre top
 * tracks barely change, so a cache hit skips the network call entirely.
 * Empty results (often a transient failure) are not cached.
 */
async function cachedLastfm<T extends unknown[]>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const sql = getSql();
  try {
    const hit = await sql`SELECT payload FROM lastfm_cache WHERE cache_key = ${cacheKey}`;
    if (hit.length > 0) return hit[0].payload as T;
  } catch {
    /* fall through */
  }
  const fresh = await fetchFn();
  if (fresh.length > 0) {
    try {
      await sql`
        INSERT INTO lastfm_cache (cache_key, payload)
        VALUES (${cacheKey}, ${JSON.stringify(fresh)}::jsonb)
        ON CONFLICT (cache_key) DO NOTHING`;
    } catch {
      /* best-effort */
    }
  }
  return fresh;
}

/** Last.fm similar tracks for a seed song. */
async function lastfmSimilar(artist: string, track: string): Promise<Cand[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  return cachedLastfm(`sim:${artist.toLowerCase()}|${track.toLowerCase()}`, async () => {
    try {
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
          seedTrack: "",
          recType: "song" as const,
        }))
        .filter((x: Cand) => x.artist && x.title);
    } catch {
      return [];
    }
  });
}

/** Last.fm top tracks for a genre tag. */
async function tagTopTracks(tag: string): Promise<{ artist: string; title: string }[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  return cachedLastfm(`tag:${tag.toLowerCase()}`, async () => {
    try {
      const data = await getJson(
        `${LASTFM}?method=tag.gettoptracks&format=json&limit=70` +
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
    } catch {
      return [];
    }
  });
}

function shuffle<T>(arr: T[]): T[] {
  return arr.map((v) => ({ v, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.v);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Builds recommendation candidates for one mode:
 *   song    — Last.fm similar tracks of random liked songs
 *   genre   — top tracks of the user's own dominant genres
 *   unheard — top tracks of broad genres the user barely touches
 *   indie   — like "song", but kept only if the Deezer popularity is low
 *   mix     — a blend of song + unheard
 * Already-liked / disliked / previously-recommended artists are excluded.
 */
export async function generateRecommendations(
  userId: string,
  mode: RecMode = "mix",
): Promise<RecRow[]> {
  const sql = getSql();

  const [seeds, likedRows, existingRows, dislikedRows, genreRows] = await Promise.all([
    // One random track per artist, then 6 — affinity-weighted but artist-
    // diverse, so recommendations don't all stem from a single song/artist.
    sql`
      SELECT artist, title
      FROM (
        SELECT DISTINCT ON (t.artist)
               t.artist AS artist, t.title AS title,
               COALESCE(aff.weight, 1) AS w
        FROM user_tracks ut
        JOIN tracks t ON t.id = ut.track_id
        LEFT JOIN artist_affinity aff
          ON aff.user_id = ut.user_id AND lower(aff.artist) = lower(t.artist)
        WHERE ut.user_id = ${userId}
        ORDER BY t.artist, random()
      ) s
      ORDER BY random() / s.w
      LIMIT 6`,
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
      SELECT lower(k.key) AS g, count(*)::int AS c
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
      WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
      GROUP BY lower(k.key) ORDER BY c DESC`,
  ]);
  if (seeds.length === 0) return [];

  const likedArtists = new Set(likedRows.map((r) => r.a as string));
  const existing = new Set(existingRows.map((r) => r.k as string));
  const dislikedArtists = new Set(dislikedRows.map((r) => r.a as string));
  const userGenres = genreRows.map((r) => r.g as string);
  const topGenres = userGenres.slice(0, 10);

  // ── candidate pools ──
  const songPool = async (): Promise<Cand[]> => {
    const lists = await Promise.all(seeds.map((s) => lastfmSimilar(s.artist as string, s.title as string)));
    return lists
      .flatMap((sims, i) =>
        sims.map((c) => ({ ...c, seedTrack: `${seeds[i].artist} - ${seeds[i].title}` })),
      )
      .sort((a, b) => b.match - a.match);
  };
  const genrePool = async (): Promise<Cand[]> => {
    const gs = shuffle(topGenres).slice(0, 4);
    const lists = await Promise.all(gs.map((g) => tagTopTracks(g)));
    return lists.flatMap((ts, i) =>
      shuffle(ts).map((t) => ({
        artist: t.artist, title: t.title, match: 0, seedTrack: gs[i], recType: "genre" as const,
      })),
    );
  };
  const unheardPool = async (): Promise<Cand[]> => {
    const gs = shuffle(
      BROAD_GENRES.filter((g) => !userGenres.some((ug) => ug.includes(g) || g.includes(ug))),
    ).slice(0, 3);
    const lists = await Promise.all(gs.map((g) => tagTopTracks(g)));
    return lists.flatMap((ts, i) =>
      shuffle(ts).map((t) => ({
        artist: t.artist, title: t.title, match: 0, seedTrack: gs[i], recType: "unheard" as const,
      })),
    );
  };

  let pool: Cand[];
  if (mode === "song" || mode === "indie") pool = await songPool();
  else if (mode === "genre") pool = await genrePool();
  else if (mode === "unheard") pool = await unheardPool();
  else {
    const [a, b] = await Promise.all([songPool(), unheardPool()]);
    pool = [...a, ...b];
  }

  // ── dedup + exclude ──
  const seen = new Set<string>();
  const filtered: Cand[] = [];
  for (const c of pool) {
    const aL = c.artist.toLowerCase();
    const key = `${aL}|${c.title.toLowerCase()}`;
    if (likedArtists.has(aL) || dislikedArtists.has(aL)) continue;
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    filtered.push(c);
  }

  // ── resolve Deezer in small chunks (cover, preview, rank) ──
  // Chunked + spaced so we stay well under Deezer's rate limit — bursts here
  // were getting the whole Worker IP throttled, breaking playback elsewhere.
  const TARGET = 12;
  const slice = filtered.slice(0, mode === "indie" ? 30 : 20);
  const rows: RecRow[] = [];
  for (let i = 0; i < slice.length && rows.length < TARGET; i += 6) {
    const chunk = slice.slice(i, i + 6);
    const matches = await Promise.all(
      chunk.map((c) => searchDeezer(c.artist, c.title, { withYear: false })),
    );
    chunk.forEach((c, k) => {
      if (rows.length >= TARGET) return;
      const d = matches[k];
      if (!d.previewUrl) return;
      if (mode === "indie" && (d.rank == null || d.rank > INDIE_MAX_RANK)) return;
      rows.push({
        artist: c.artist,
        title: c.title,
        album: d.album,
        coverUrl: d.coverUrl,
        deezerId: d.deezerId,
        previewUrl: d.previewUrl,
        seedTrack: c.seedTrack,
        score: c.recType === "song" ? c.match : null,
        recType: mode === "indie" ? "indie" : c.recType,
      });
    });
    if (rows.length < TARGET && i + 6 < slice.length) await sleep(350);
  }
  return rows;
}
