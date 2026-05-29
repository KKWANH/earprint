import { getSql } from "./db";
import { getJson } from "./http";
import { searchDeezer } from "./deezer";
import { captureError } from "./sentry";

/** Recommendation flavour the user can choose. */
export type RecMode =
  | "song"
  | "genre"
  | "unheard"
  | "indie"
  | "mix"
  // R28d — uses /me/top/tracks ingested into user_tracks with
  // source='spotify-top' as seeds instead of random library picks.
  // Steers Last.fm similar-tracks toward the user's HEAVY-rotation
  // taste rather than the broad library average.
  | "spotify-top";

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
// Deezer rank above this ≈ a well-known hit; "hidden gems" must sit below it.
const HIDDEN_GEM_MAX_RANK = 200_000;

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

/** Random shuffle (Schwartzian). Exported for unit testing (R38). */
export function shuffle<T>(arr: T[]): T[] {
  return arr.map((v) => ({ v, k: Math.random() })).sort((a, b) => a.k - b.k).map((x) => x.v);
}

/**
 * Round-robin merge — takes the i-th item of every list in turn. A slice of
 * the result is balanced across all sources, so recommendations don't end up
 * dominated by a single seed song / genre. Exported for unit testing (R38).
 */
export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Builds recommendation candidates for one mode:
 *   song    — Last.fm similar tracks of random liked songs
 *   genre   — top tracks of the user's own dominant genres
 *   unheard — top tracks of the broad genres the user has explored least
 *   indie   — "hidden gems": similar tracks, kept only if low-popularity
 *   mix     — a blend of song + unheard
 * Already-liked / disliked / previously-recommended artists are excluded.
 */
export async function generateRecommendations(
  userId: string,
  mode: RecMode = "mix",
): Promise<RecRow[]> {
  const sql = getSql();

  // R28d — when mode='spotify-top' the seeds come from user_tracks
  // rows that were inserted via Spotify's /me/top/tracks (source=
  // 'spotify-top'), so the Last.fm similar-tracks pool steers off
  // the user's heavy-rotation taste instead of the random library
  // sample. Falls back to the default seeds query when the user has
  // no spotify-top rows yet — better than returning empty.
  const seedsQuery =
    mode === "spotify-top"
      ? sql`
          SELECT artist, title
          FROM (
            SELECT DISTINCT ON (artist_canon(t.artist, t.deezer_artist_id))
                   t.artist AS artist, t.title AS title
            FROM user_tracks ut
            JOIN tracks t ON t.id = ut.track_id
            WHERE ut.user_id = ${userId}
              AND ut.source = 'spotify-top'
            ORDER BY artist_canon(t.artist, t.deezer_artist_id), random()
          ) s
          ORDER BY random()
          LIMIT 6`
      : sql`
          SELECT artist, title
          FROM (
            SELECT DISTINCT ON (artist_canon(t.artist, t.deezer_artist_id))
                   t.artist AS artist, t.title AS title,
                   COALESCE(aff.weight, 1) AS w
            FROM user_tracks ut
            JOIN tracks t ON t.id = ut.track_id
            LEFT JOIN artist_affinity aff
              ON aff.user_id = ut.user_id
              AND lower(artist_canon(aff.artist, NULL))
                = lower(artist_canon(t.artist, t.deezer_artist_id))
            WHERE ut.user_id = ${userId}
            ORDER BY artist_canon(t.artist, t.deezer_artist_id), random()
          ) s
          ORDER BY random() / s.w
          LIMIT 6`;

  const [seeds, likedRows, existingRows, dislikedRows, genreRows] = await Promise.all([
    seedsQuery,
    // Blocklist of liked artists — canonicalized so a user who likes "BTS"
    // doesn't get "방탄소년단" recommended back as if it were a new find.
    sql`
      SELECT DISTINCT lower(artist_canon(t.artist, t.deezer_artist_id)) AS a
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
  const genreCount = new Map<string, number>(
    genreRows.map((r) => [r.g as string, r.c as number]),
  );

  // ── candidate pools ──
  // Each pool round-robins its sources (seeds / genres) so a slice taken later
  // is balanced — the batch doesn't all stem from one seed song or genre.
  const songPool = async (): Promise<Cand[]> => {
    const lists = await Promise.all(seeds.map((s) => lastfmSimilar(s.artist as string, s.title as string)));
    const perSeed = lists.map((sims, i) =>
      sims
        .map((c) => ({ ...c, seedTrack: `${seeds[i].artist} - ${seeds[i].title}` }))
        .sort((a, b) => b.match - a.match),
    );
    return interleave(perSeed);
  };
  const genrePool = async (): Promise<Cand[]> => {
    const gs = shuffle(topGenres).slice(0, 4);
    const lists = await Promise.all(gs.map((g) => tagTopTracks(g)));
    return interleave(
      lists.map((ts, i) =>
        shuffle(ts).map((t) => ({
          artist: t.artist, title: t.title, match: 0, seedTrack: gs[i], recType: "genre" as const,
        })),
      ),
    );
  };
  const unheardPool = async (): Promise<Cand[]> => {
    // The broad genres the user has explored *least* — a broad listener may
    // have a little of everything, so "genres entirely absent" is often empty.
    const presence = (g: string) => {
      let n = 0;
      for (const [ug, c] of genreCount) {
        if (ug.includes(g) || g.includes(ug)) n += c;
      }
      return n;
    };
    const leastExplored = [...BROAD_GENRES].sort((a, b) => presence(a) - presence(b));
    const gs = shuffle(leastExplored.slice(0, 6)).slice(0, 3);
    const lists = await Promise.all(gs.map((g) => tagTopTracks(g)));
    return interleave(
      lists.map((ts, i) =>
        shuffle(ts).map((t) => ({
          artist: t.artist, title: t.title, match: 0, seedTrack: gs[i], recType: "unheard" as const,
        })),
      ),
    );
  };

  // Embedding-similarity pool — only fires when the user has a taste
  // centroid (populated after the MIR phase runs) AND there are enough
  // candidate embeddings in the DB to draw from. Until MIR ships this
  // returns []; the rest of the function then degrades cleanly to the
  // text-tag matching that's been live the whole time.
  const embeddingPool = async (): Promise<Cand[]> => {
    try {
      const rows = await sql`
        WITH centroid AS (
          SELECT centroid FROM taste_profiles
          WHERE user_id = ${userId} AND centroid IS NOT NULL
        )
        SELECT t.artist, t.title,
               (e.vector <=> (SELECT centroid FROM centroid)) AS distance
        FROM embeddings e
        JOIN tracks t ON t.id = e.track_id
        WHERE EXISTS (SELECT 1 FROM centroid)
          AND NOT EXISTS (
            SELECT 1 FROM user_tracks ut
            WHERE ut.user_id = ${userId} AND ut.track_id = e.track_id
          )
        ORDER BY distance ASC
        LIMIT 30`;
      return rows.map((r) => ({
        artist: r.artist as string,
        title: r.title as string,
        // distance is 0..2 for cosine; flip to a 0..1 similarity for the
        // `score` field downstream consumers expect.
        match: Math.max(0, 1 - (r.distance as number) / 2),
        seedTrack: "your taste",
        recType: "song" as const,
      }));
    } catch (e) {
      // Most users legitimately have no centroid yet (MIR hasn't run for
      // them), and that path normally returns [] without throwing. If
      // we're in the catch block something else broke — missing pgvector
      // extension, centroid column dropped, mis-typed query. Capture so
      // a real regression doesn't silently degrade recommend quality.
      captureError(e, { tag: "recommend.embedding-pool" });
      return [];
    }
  };

  let pool: Cand[];
  if (mode === "song" || mode === "indie" || mode === "spotify-top")
    pool = await songPool();
  else if (mode === "genre") pool = await genrePool();
  else if (mode === "unheard") pool = await unheardPool();
  else {
    // Mix mode: prefer embeddings when available (much more accurate
    // than Last.fm tag similarity) and interleave with the unheard pool
    // for discovery breadth. Falls back to the original song+unheard
    // mix when the embedding pool is empty.
    const [emb, a, b] = await Promise.all([
      embeddingPool(),
      songPool(),
      unheardPool(),
    ]);
    pool = emb.length > 0 ? interleave([emb, b, a]) : interleave([a, b]);
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
  // Chunked + spaced so we stay under Deezer's rate limit AND
  // Cloudflare Workers' per-invocation subrequest cap. Free tier
  // is 50/invocation; Workers Paid (our current plan) is 1000 —
  // headroom for the cold-cache worst case (~20 candidates × 4
  // subreq each = 80, plus the Last.fm + initial query subrequests
  // = still well under 1000).
  //
  // Numbers below were aggressively cut in R22c when we were tripping
  // the 50 cap; restored in R24a now that paid is on. The graceful
  // break on subrequest exhaustion is KEPT — even on paid we want
  // to fail soft instead of bubbling 500s on the off chance we
  // touch the ceiling.
  const TARGET = 12;
  // "indie" (hidden gems) discards most candidates to the popularity filter,
  // so it needs a much larger pool to resolve.
  const slice = filtered.slice(0, mode === "indie" ? 30 : 20);
  const rows: RecRow[] = [];
  const isSubreqError = (e: unknown): boolean => {
    const s = String((e as { message?: string })?.message ?? e ?? "");
    return /too many subrequests/i.test(s) || /subrequest/i.test(s);
  };
  outer: for (let i = 0; i < slice.length && rows.length < TARGET; i += 6) {
    const chunk = slice.slice(i, i + 6);
    let matches: Awaited<ReturnType<typeof searchDeezer>>[];
    try {
      matches = await Promise.all(
        chunk.map((c) => searchDeezer(c.artist, c.title, { withYear: false })),
      );
    } catch (e) {
      // If we tripped the Worker subrequest cap mid-chunk, bail out with
      // whatever we already collected instead of bubbling up a 500.
      // Caller still gets a non-empty `added` count when the earlier
      // chunks resolved enough rows.
      if (isSubreqError(e)) break outer;
      throw e;
    }
    chunk.forEach((c, k) => {
      if (rows.length >= TARGET) return;
      const d = matches[k];
      if (!d.previewUrl) return;
      if (mode === "indie" && (d.rank == null || d.rank > HIDDEN_GEM_MAX_RANK)) return;
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
