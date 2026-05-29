import { getSql } from "./db";
import { getJson } from "./http";
import { z } from "zod";
import { aiJson, sanitizeAiString } from "./ai";
import { genreMatchKeys } from "./genreDict";

const GenreDescZ = z.object({
  en: z.string().max(800).transform(sanitizeAiString),
  ko: z.string().max(800).transform(sanitizeAiString),
});

const LASTFM = "https://ws.audioscrobbler.com/2.0/";

export interface GenreTrack {
  title: string;
  artist: string;
  deezerId: number | null;
  /** R34 — additional fields powering the sort options on the
   *  genre page (added / alpha / popularity). Nullable on legacy
   *  rows that haven't been re-enriched. */
  capturedAt: Date | null;
  deezerRank: number | null;
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
  /** R29b — energy / tempo / acousticness averages over the user's
   *  tracks in this genre. null when none of them have been
   *  audio_feel-analyzed yet. */
  audioFeel: {
    analyzed: number;
    energy: number;
    tempo: number;
    acousticness: number;
  } | null;
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

/** AI genre description in both languages. Best-effort — null on failure.
 *  `userId` is attributed against the per-user Gemini cap; the result is
 *  globally cached, so subsequent users hitting the same genre never burn
 *  a second call regardless of who warmed it. */
async function genreDescription(
  genre: string,
  userId?: string,
): Promise<{ en: string | null; ko: string | null }> {
  try {
    const raw = await aiJson<unknown>(
      `음악 장르 "${genre}"에 대한 간결한 소개를 작성하세요. 기원·시대적 배경과 ` +
        `음악적 특징(사운드·악기·분위기)을 2~3문장으로 정확하게 설명하세요. ` +
        `en 필드는 영어로, ko 필드는 자연스러운 한국어로 작성. ` +
        `실제 음악 장르가 아니거나 모호하면 두 필드 모두 빈 문자열.`,
      DESC_SCHEMA,
      userId ? { userId } : undefined,
    );
    const r = GenreDescZ.safeParse(raw);
    if (!r.success) return { en: null, ko: null };
    return { en: r.data.en?.trim() || null, ko: r.data.ko?.trim() || null };
  } catch {
    return { en: null, ko: null };
  }
}

/** Loads cached genre info; on a cache miss, builds the cheap fields fast.
 *
 *  The previous version tried to fill *everything* inline on cache miss —
 *  including a synchronous Gemini call. On Workers free plan (10ms CPU per
 *  request) that crossed the budget for new genres and produced Error 1102.
 *  We now ship the cheap parts (Last.fm tag lookups, which are I/O-bound)
 *  inline and leave the AI description for `/api/genre/warm` to fill in
 *  out of band — see warmGenreDescription() below. The page renders
 *  immediately; the description fades in on a subsequent visit (or the
 *  client component can poll it). */
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

  // Last.fm only — I/O-bound, ~100ms wall but trivial CPU.
  const [topArtists, topTracks] = await Promise.all([
    tagTopArtists(genre),
    tagTopTracks(genre),
  ]);
  try {
    await sql`
      INSERT INTO genre_info
        (genre, description_en, description_ko, top_artists, top_tracks)
      VALUES (
        ${key}, NULL, NULL,
        ${JSON.stringify(topArtists)}::jsonb, ${JSON.stringify(topTracks)}::jsonb)
      ON CONFLICT (genre) DO NOTHING`;
  } catch {
    /* best-effort cache */
  }
  return {
    descriptionEn: null,
    descriptionKo: null,
    topArtists,
    topTracks,
  };
}

/** Fills the description column for a genre. Called by `/api/genre/warm`
 *  from the client after the page is on-screen — it dodges Workers' per-
 *  request CPU budget by running in its own request rather than blocking
 *  the page render. Safe to call repeatedly: the SQL only writes if both
 *  description columns are currently NULL. */
export async function warmGenreDescription(
  genre: string,
  userId?: string,
): Promise<{
  descriptionEn: string | null;
  descriptionKo: string | null;
}> {
  const sql = getSql();
  const key = genre.toLowerCase();
  // Skip if already filled.
  const existing = await sql`
    SELECT description_en, description_ko FROM genre_info WHERE genre = ${key}`;
  if (existing.length > 0) {
    const e = existing[0]!;
    if (e.description_en || e.description_ko) {
      return {
        descriptionEn: (e.description_en as string) ?? null,
        descriptionKo: (e.description_ko as string) ?? null,
      };
    }
  }
  const desc = await genreDescription(genre, userId);
  try {
    await sql`
      UPDATE genre_info
      SET description_en = ${desc.en}, description_ko = ${desc.ko}
      WHERE genre = ${key}
        AND description_en IS NULL AND description_ko IS NULL`;
  } catch {
    /* best-effort */
  }
  return { descriptionEn: desc.en, descriptionKo: desc.ko };
}

/** Everything the genre detail page needs. */
export async function getGenreDetail(
  userId: string,
  genre: string,
): Promise<GenreDetail> {
  const sql = getSql();
  const lc = genre.toLowerCase();
  // R35 — same 0.30 weight floor as /genres. A track only counts as
  // "in" a genre when the AI's confidence is ≥ 0.30; below that the
  // tag is noise and surfacing the track misleadingly puts it in
  // genres the user doesn't actually associate with.
  const GENRE_WEIGHT_FLOOR = 0.30;
  // R37 — alias-aware matching. The slug might be a canonical label
  // ("Synth-Pop") while the JSONB stores raw Gemini keys
  // ("synth-pop" / "synthpop"). genreMatchKeys() returns every
  // normalized variant; the SQL normalizes each JSONB key the same
  // way (lower + collapse [-_/&] + whitespace) and checks membership
  // so any spelling variant matches. matchKeys is never empty (falls
  // back to the normalized slug for unknown genres).
  const matchKeys = genreMatchKeys(genre);
  const matchKeysArr = matchKeys.length > 0 ? matchKeys : [lc];
  const [trackRows, info, feelRows] = await Promise.all([
    sql`
      SELECT t.title, t.artist, t.deezer_id, t.deezer_rank, ut.captured_at
      FROM user_tracks ut
      JOIN tracks t ON t.id = ut.track_id
      JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
      WHERE ut.user_id = ${userId}
        AND a.genres IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_each(a.genres) e
          WHERE trim(regexp_replace(regexp_replace(lower(e.key), '[-_/&]+', ' ', 'g'), '\\s+', ' ', 'g'))
                = ANY(${matchKeysArr}::text[])
            AND (CASE WHEN jsonb_typeof(e.value) = 'number' THEN (e.value)::text::float ELSE 0 END) >= ${GENRE_WEIGHT_FLOOR}
        )
      ORDER BY t.artist, t.title
      LIMIT 60`,
    loadGenreInfo(genre),
    // R29b — energy/tempo/acousticness averages across this user's
    // analyzed tracks in this genre. Returns no rows when none of
    // the matching tracks have audio_feel populated yet.
    sql`
      SELECT count(*)::int                                 AS analyzed,
             avg((a.audio_feel ->> 'energy')::float)       AS energy,
             avg((a.audio_feel ->> 'tempo')::float)        AS tempo,
             avg((a.audio_feel ->> 'acousticness')::float) AS acousticness
      FROM user_tracks ut
      JOIN analysis a ON a.track_id = ut.track_id AND a.analysis_version = 1
      WHERE ut.user_id = ${userId}
        AND a.genres IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM jsonb_each(a.genres) e
          WHERE trim(regexp_replace(regexp_replace(lower(e.key), '[-_/&]+', ' ', 'g'), '\\s+', ' ', 'g'))
                = ANY(${matchKeysArr}::text[])
            AND (CASE WHEN jsonb_typeof(e.value) = 'number' THEN (e.value)::text::float ELSE 0 END) >= ${GENRE_WEIGHT_FLOOR}
        )
        AND a.audio_feel ? 'energy'`,
  ]);
  const userTracks: GenreTrack[] = trackRows.map((r) => ({
    title: r.title as string,
    artist: r.artist as string,
    deezerId: (r.deezer_id as number) ?? null,
    capturedAt: r.captured_at ? new Date(r.captured_at as string) : null,
    deezerRank: (r.deezer_rank as number) ?? null,
  }));
  const fr = feelRows[0];
  const audioFeel =
    fr && Number(fr.analyzed ?? 0) > 0
      ? {
          analyzed: Number(fr.analyzed),
          energy: Number(fr.energy ?? 0),
          tempo: Number(fr.tempo ?? 0),
          acousticness: Number(fr.acousticness ?? 0),
        }
      : null;
  return {
    name: genre,
    inLibrary: userTracks.length > 0,
    userTrackCount: userTracks.length,
    userTracks,
    descriptionEn: info.descriptionEn,
    descriptionKo: info.descriptionKo,
    topArtists: info.topArtists,
    topTracks: info.topTracks,
    audioFeel,
  };
}
