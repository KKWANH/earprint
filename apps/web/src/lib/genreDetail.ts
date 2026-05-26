import { getSql } from "./db";
import { getJson } from "./http";
import { z } from "zod";
import { aiJson } from "./ai";

const GenreDescZ = z.object({
  en: z.string().max(800),
  ko: z.string().max(800),
});

const LASTFM = "https://ws.audioscrobbler.com/2.0/";

export interface GenreTrack {
  title: string;
  artist: string;
  deezerId: number | null;
}

export interface GenreDetail {
  name: string;
  inLibrary: boolean;
  userTrackCount: number;
  userTracks: GenreTrack[];
  descriptionEn: string | null;
  descriptionKo: string | null;
  topArtists: string[];
  topTracks: { artist: string; title: string }[];
}

const DESC_SCHEMA = {
  type: "OBJECT",
  properties: { en: { type: "STRING" }, ko: { type: "STRING" } },
  required: ["en", "ko"],
};

/** Last.fm artists most associated with a genre tag. */
async function tagTopArtists(genre: string): Promise<string[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  try {
    const data = await getJson(
      `${LASTFM}?method=tag.gettopartists&format=json&limit=12` +
        `&tag=${encodeURIComponent(genre)}&api_key=${key}`,
    );
    let a = data?.topartists?.artist;
    if (!Array.isArray(a)) a = a ? [a] : [];
    return a
      .map((x: { name?: unknown }) => String(x?.name ?? "").trim())
      .filter((n: string) => n)
      .slice(0, 10);
  } catch {
    return [];
  }
}

/** Last.fm tracks most associated with a genre tag. */
async function tagTopTracks(genre: string): Promise<{ artist: string; title: string }[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  try {
    const data = await getJson(
      `${LASTFM}?method=tag.gettoptracks&format=json&limit=16` +
        `&tag=${encodeURIComponent(genre)}&api_key=${key}`,
    );
    let t = data?.tracks?.track;
    if (!Array.isArray(t)) t = t ? [t] : [];
    return t
      .map((x: { name?: unknown; artist?: { name?: unknown } }) => ({
        artist: String(x?.artist?.name ?? "").trim(),
        title: String(x?.name ?? "").trim(),
      }))
      .filter((x: { artist: string; title: string }) => x.artist && x.title)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/** AI genre description in both languages. Best-effort — null on failure. */
async function genreDescription(
  genre: string,
): Promise<{ en: string | null; ko: string | null }> {
  try {
    const raw = await aiJson<unknown>(
      `음악 장르 "${genre}"에 대한 간결한 소개를 작성하세요. 기원·시대적 배경과 ` +
        `음악적 특징(사운드·악기·분위기)을 2~3문장으로 정확하게 설명하세요. ` +
        `en 필드는 영어로, ko 필드는 자연스러운 한국어로 작성. ` +
        `실제 음악 장르가 아니거나 모호하면 두 필드 모두 빈 문자열.`,
      DESC_SCHEMA,
    );
    const r = GenreDescZ.safeParse(raw);
    if (!r.success) return { en: null, ko: null };
    return { en: r.data.en?.trim() || null, ko: r.data.ko?.trim() || null };
  } catch {
    return { en: null, ko: null };
  }
}

/** Loads cached genre info; on a cache miss, builds and caches it once. */
async function loadGenreInfo(genre: string) {
  const sql = getSql();
  const key = genre.toLowerCase();
  try {
    const cached = await sql`
      SELECT description_en, description_ko, top_artists, top_tracks
      FROM genre_info WHERE genre = ${key}`;
    if (cached.length > 0) {
      return {
        descriptionEn: (cached[0].description_en as string) ?? null,
        descriptionKo: (cached[0].description_ko as string) ?? null,
        topArtists: (cached[0].top_artists as string[]) ?? [],
        topTracks: (cached[0].top_tracks as { artist: string; title: string }[]) ?? [],
      };
    }
  } catch {
    /* fall through to a fresh build */
  }

  const [desc, topArtists, topTracks] = await Promise.all([
    genreDescription(genre),
    tagTopArtists(genre),
    tagTopTracks(genre),
  ]);
  try {
    await sql`
      INSERT INTO genre_info
        (genre, description_en, description_ko, top_artists, top_tracks)
      VALUES (
        ${key}, ${desc.en}, ${desc.ko},
        ${JSON.stringify(topArtists)}::jsonb, ${JSON.stringify(topTracks)}::jsonb)
      ON CONFLICT (genre) DO NOTHING`;
  } catch {
    /* best-effort cache */
  }
  return {
    descriptionEn: desc.en,
    descriptionKo: desc.ko,
    topArtists,
    topTracks,
  };
}

/** Everything the genre detail page needs. */
export async function getGenreDetail(
  userId: string,
  genre: string,
): Promise<GenreDetail> {
  const sql = getSql();
  const [trackRows, info] = await Promise.all([
    sql`
      SELECT t.title, t.artist, t.deezer_id
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
      WHERE ut.user_id = ${userId}
        AND jsonb_exists(a.genres, ${genre.toLowerCase()})
      ORDER BY t.artist, t.title
      LIMIT 60`,
    loadGenreInfo(genre),
  ]);
  const userTracks: GenreTrack[] = trackRows.map((r) => ({
    title: r.title as string,
    artist: r.artist as string,
    deezerId: (r.deezer_id as number) ?? null,
  }));
  return {
    name: genre,
    inLibrary: userTracks.length > 0,
    userTrackCount: userTracks.length,
    userTracks,
    descriptionEn: info.descriptionEn,
    descriptionKo: info.descriptionKo,
    topArtists: info.topArtists,
    topTracks: info.topTracks,
  };
}
