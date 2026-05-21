import { getAffinities } from "./affinity";
import { getSql } from "./db";
import { getJson } from "./http";
import { getExcludedArtists } from "./library";

/** One artist node for the interactive map. */
export interface ArtistNode {
  name: string;
  count: number; // liked track count
  affinity: number; // preference weight: 1 normal · 2 좋아함 · 3 최애
  /** Top genres for this artist, [genre, weight] sorted desc. */
  genres: [string, number][];
}

export interface ArtistMapData {
  artists: ArtistNode[];
  /** How many of the returned artists have any genre data yet. */
  analyzed: number;
}

const MAX_ARTISTS = 160; // a readable, performant map

/**
 * Canonical artist name — collapses near-duplicates that YouTube Music emits
 * as separate strings: "검정치마" vs "검정치마 (The Black Skirts)", "Artist -
 * Topic", "Artist VEVO" etc. all fold to one node.
 */
export function canonArtist(name: string): string {
  const c = name
    .replace(/\s*[([][^()[\]]*[)\]]\s*/g, " ") // drop "(The Black Skirts)", "[MV]"
    .replace(/\s*[-–—]\s*topic\s*$/i, "") // YouTube auto "Artist - Topic"
    .replace(/\s*\bvevo\b\s*/gi, " ")
    .replace(/\s*\bofficial\b\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return c || name.trim();
}

/**
 * Obvious non-artist entries — karaoke / compilation / playlist channels.
 * Arbitrary YouTuber channels with no tell-tale keyword can't be detected
 * reliably; those are left to the manual "exclude" action on the map.
 */
function isLikelyNonArtist(name: string): boolean {
  const n = name.toLowerCase().trim();
  if (!n || n === "unknown") return true;
  return (
    /\b(various artists|various|v\.?\s?a\.?)\b/.test(n) ||
    /(노래방|가라오케|karaoke|금영|kumyoung|반주)/.test(n) ||
    /(playlist|플레이리스트|lo-?fi|로파이)/.test(n) ||
    /(노래\s?모음|곡\s?모음|music\s?box|뮤직박스)/.test(n)
  );
}

/**
 * Builds the artist map dataset — the user's most-liked artists with their
 * aggregated genre fingerprints. Near-duplicate artist names are merged.
 */
export async function getArtistMap(userId: string): Promise<ArtistMapData> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);
  const excludedCanon = new Set(excluded.map((a) => canonArtist(a).toLowerCase()));
  const affinities = await getAffinities(userId);

  // Per (artist, genre): how many of the artist's liked tracks carry that genre.
  const rows = await sql`
    SELECT t.artist                       AS artist,
           cnt.n                          AS track_count,
           g.key                          AS genre,
           count(*)::int                  AS genre_count
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    JOIN LATERAL (
      SELECT count(*)::int AS n
      FROM user_tracks ut2
      JOIN tracks t2 ON t2.id = ut2.track_id
      WHERE ut2.user_id = ${userId} AND t2.artist = t.artist
    ) cnt ON true
    LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
    LEFT JOIN LATERAL jsonb_object_keys(a.genres) AS g(key) ON true
    WHERE ut.user_id = ${userId} AND t.artist <> ALL(${excluded}::text[])
    GROUP BY t.artist, cnt.n, g.key`;

  interface Acc {
    display: string;
    count: number;
    genres: Map<string, number>;
    rawNames: Set<string>;
    counted: Set<string>; // raw artist strings already added to count
  }
  const map = new Map<string, Acc>();

  for (const r of rows) {
    const raw = r.artist as string;
    const canon = canonArtist(raw);
    const key = canon.toLowerCase();
    if (excludedCanon.has(key) || isLikelyNonArtist(canon)) continue;

    let node = map.get(key);
    if (!node) {
      node = { display: canon, count: 0, genres: new Map(), rawNames: new Set(), counted: new Set() };
      map.set(key, node);
    }
    // track_count is per raw artist string — add it once per raw variant.
    if (!node.counted.has(raw)) {
      node.counted.add(raw);
      node.count += r.track_count as number;
      node.rawNames.add(raw);
      // Prefer the shortest variant as the display name (usually the cleanest).
      const cleaned = canonArtist(raw);
      if (cleaned.length > 0 && cleaned.length < node.display.length) node.display = cleaned;
    }
    const genre = r.genre as string | null;
    if (genre) node.genres.set(genre, (node.genres.get(genre) ?? 0) + (r.genre_count as number));
  }

  const artists: ArtistNode[] = [...map.values()]
    .map((v) => ({
      name: v.display,
      count: v.count,
      affinity: affinities[v.display.toLowerCase()] ?? 1,
      genres: [...v.genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_ARTISTS);

  return {
    artists,
    analyzed: artists.filter((a) => a.genres.length > 0).length,
  };
}

/* ───────────────  Discovery: unheard, related artists  ─────────────── */

const LASTFM = "https://ws.audioscrobbler.com/2.0/";

/** An artist the user has not liked yet, surfaced from Last.fm similarity. */
export interface GhostArtist {
  name: string;
  related: string[]; // library artist display names this one connects to
  score: number;
}

/** Last.fm "similar artists" for one seed artist. */
async function lastfmSimilarArtists(
  artist: string,
): Promise<{ name: string; match: number }[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  try {
    const data = await getJson(
      `${LASTFM}?method=artist.getsimilar&autocorrect=1&format=json&limit=14` +
        `&artist=${encodeURIComponent(artist)}&api_key=${key}`,
    );
    let a = data?.similarartists?.artist;
    if (!a) return [];
    if (!Array.isArray(a)) a = [a];
    return a
      .map((x: { name?: unknown; match?: unknown }) => ({
        name: String(x?.name ?? "").trim(),
        match: Math.max(0, Math.min(1, Number(x?.match ?? 0))),
      }))
      .filter((x: { name: string }) => x.name);
  } catch {
    return [];
  }
}

type SimList = { name: string; match: number }[];

/**
 * Last.fm similar artists for several seeds, served from a shared DB cache.
 * Similar-artist lists barely change, so a cache hit avoids the network call
 * entirely — the main cost of loading the artist map. Empty results (often a
 * transient failure) are not cached, so they self-heal on the next visit.
 */
async function cachedSimilarArtists(names: string[]): Promise<SimList[]> {
  const sql = getSql();
  const keys = names.map((n) => n.toLowerCase());
  const rows = await sql`
    SELECT artist, payload FROM lastfm_similar WHERE artist = ANY(${keys}::text[])`;
  const have = new Map(rows.map((r) => [r.artist as string, r.payload as SimList]));

  const missIdx: number[] = [];
  for (let i = 0; i < keys.length; i++) if (!have.has(keys[i])) missIdx.push(i);
  const fetched = await Promise.all(missIdx.map((i) => lastfmSimilarArtists(names[i])));

  const store: { artist: string; payload: SimList }[] = [];
  missIdx.forEach((i, k) => {
    have.set(keys[i], fetched[k]);
    if (fetched[k].length > 0) store.push({ artist: keys[i], payload: fetched[k] });
  });
  if (store.length > 0) {
    await sql`
      INSERT INTO lastfm_similar (artist, payload)
      SELECT x->>'artist', x->'payload'
      FROM jsonb_array_elements(${JSON.stringify(store)}::jsonb) AS x
      ON CONFLICT (artist) DO NOTHING`;
  }
  return keys.map((k) => have.get(k) ?? []);
}

/**
 * Finds artists the user has *not* liked but who are close to their taste —
 * Last.fm similar artists of the top library artists, minus anything already
 * in the library. Each ghost keeps the library artists it connects to so the
 * map can draw edges and place it inside the right cluster.
 */
export async function getGhostArtists(
  userId: string,
  libraryArtists: ArtistNode[],
): Promise<GhostArtist[]> {
  const seeds = libraryArtists.slice(0, 14);
  if (seeds.length === 0) return [];

  // Skip artists already liked OR explicitly excluded ("싫어해요").
  const excluded = await getExcludedArtists(userId);
  const libraryCanon = new Set([
    ...libraryArtists.map((a) => canonArtist(a.name).toLowerCase()),
    ...excluded.map((a) => canonArtist(a).toLowerCase()),
  ]);

  const lists = await cachedSimilarArtists(seeds.map((s) => s.name));

  const ghosts = new Map<string, { name: string; related: Set<string>; score: number }>();
  lists.forEach((sims, i) => {
    for (const sim of sims) {
      const canon = canonArtist(sim.name);
      const key = canon.toLowerCase();
      if (libraryCanon.has(key) || isLikelyNonArtist(canon)) continue;
      let g = ghosts.get(key);
      if (!g) {
        g = { name: canon, related: new Set(), score: 0 };
        ghosts.set(key, g);
      }
      g.related.add(seeds[i].name);
      // multi-connected ghosts score higher (closer to the centre of taste)
      g.score += sim.match + 0.25;
    }
  });

  return [...ghosts.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 48)
    .map((g) => ({ name: g.name, related: [...g.related], score: g.score }));
}
