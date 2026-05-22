import { getSql } from "./db";
import { getJson } from "./http";

const LASTFM = "https://ws.audioscrobbler.com/2.0/";

export interface ArtistTrack {
  title: string;
  album: string | null;
  deezerId: number | null;
}

export interface ArtistDetail {
  name: string;
  inLibrary: boolean;
  trackCount: number;
  affinity: number; // 1 normal · 2 좋아함 · 3 최애
  genres: { name: string; count: number }[];
  moods: { name: string; count: number }[];
  audioFeel: { energy: number; tempo: number; acousticness: number } | null;
  albums: { name: string; count: number }[];
  tracks: ArtistTrack[];
  related: string[];
}

/** Last.fm similar artists, served from the shared lastfm_similar cache. */
async function relatedArtists(name: string): Promise<string[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  const sql = getSql();
  const cacheKey = name.toLowerCase();
  try {
    const cached = await sql`SELECT payload FROM lastfm_similar WHERE artist = ${cacheKey}`;
    if (cached.length > 0) {
      return (cached[0].payload as { name: string }[]).slice(0, 8).map((x) => x.name);
    }
  } catch {
    /* fall through */
  }
  let list: { name: string; match: number }[] = [];
  try {
    const data = await getJson(
      `${LASTFM}?method=artist.getsimilar&autocorrect=1&format=json&limit=12` +
        `&artist=${encodeURIComponent(name)}&api_key=${key}`,
    );
    let a = data?.similarartists?.artist;
    if (!Array.isArray(a)) a = a ? [a] : [];
    list = a
      .map((x: { name?: unknown; match?: unknown }) => ({
        name: String(x?.name ?? "").trim(),
        match: Number(x?.match ?? 0),
      }))
      .filter((x: { name: string }) => x.name);
  } catch {
    /* none */
  }
  if (list.length > 0) {
    try {
      await sql`
        INSERT INTO lastfm_similar (artist, payload)
        VALUES (${cacheKey}, ${JSON.stringify(list)}::jsonb)
        ON CONFLICT (artist) DO NOTHING`;
    } catch {
      /* best-effort */
    }
  }
  return list.slice(0, 8).map((x) => x.name);
}

/** Everything the artist detail page needs. */
export async function getArtistDetail(
  userId: string,
  name: string,
): Promise<ArtistDetail> {
  const sql = getSql();
  const [trackRows, affRow, feelRow] = await Promise.all([
    sql`
      SELECT t.title, t.album, t.deezer_id, a.genres, a.moods
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
      WHERE ut.user_id = ${userId} AND lower(t.artist) = lower(${name})
      ORDER BY t.album NULLS LAST, t.title`,
    sql`
      SELECT weight FROM artist_affinity
      WHERE user_id = ${userId} AND lower(artist) = lower(${name})`,
    sql`
      SELECT avg((a.audio_feel ->> 'energy')::float)       AS energy,
             avg((a.audio_feel ->> 'tempo')::float)        AS tempo,
             avg((a.audio_feel ->> 'acousticness')::float) AS acousticness
      FROM analysis a
      JOIN user_tracks ut ON ut.track_id = a.track_id
      JOIN tracks t ON t.id = a.track_id
      WHERE ut.user_id = ${userId} AND lower(t.artist) = lower(${name})
        AND a.audio_feel ? 'energy'`,
  ]);

  const genreCount = new Map<string, number>();
  const moodCount = new Map<string, number>();
  const albumCount = new Map<string, number>();
  const tracks: ArtistTrack[] = [];
  for (const r of trackRows) {
    tracks.push({
      title: r.title as string,
      album: (r.album as string) ?? null,
      deezerId: (r.deezer_id as number) ?? null,
    });
    for (const g of Object.keys((r.genres as Record<string, unknown>) ?? {})) {
      genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
    for (const m of Object.keys((r.moods as Record<string, unknown>) ?? {})) {
      moodCount.set(m, (moodCount.get(m) ?? 0) + 1);
    }
    const al = (r.album as string) ?? "";
    if (al) albumCount.set(al, (albumCount.get(al) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));

  const feel = feelRow[0];
  const energy = Number(feel?.energy);

  return {
    name,
    inLibrary: tracks.length > 0,
    trackCount: tracks.length,
    affinity: (affRow[0]?.weight as number) ?? 1,
    genres: top(genreCount, 10),
    moods: top(moodCount, 8),
    audioFeel: Number.isFinite(energy)
      ? {
          energy,
          tempo: Number(feel?.tempo) || 0,
          acousticness: Number(feel?.acousticness) || 0,
        }
      : null,
    albums: top(albumCount, 12),
    tracks,
    related: await relatedArtists(name),
  };
}
