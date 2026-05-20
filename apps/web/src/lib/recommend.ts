import { getSql } from "./db";
import { searchDeezer } from "./deezer";

/** 추천 후보 한 행 (save_recommendations 입력). */
export interface RecRow {
  artist: string;
  title: string;
  album: string | null;
  deezerId: number | null;
  previewUrl: string | null;
  seedTrack: string;
}

/** Last.fm 유사곡 — 시드 곡과 비슷한 트랙 목록. */
async function lastfmSimilar(
  artist: string,
  track: string,
): Promise<{ artist: string; title: string }[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  const url =
    `https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&autocorrect=1&format=json&limit=25` +
    `&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${key}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data: any = await res.json();
    let t = data?.similartracks?.track;
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
}

/**
 * 좋아요 곡 시드 → Last.fm 유사곡 → Deezer 미리듣기 확보.
 * 이미 좋아한/추천한/싫어요한 아티스트는 제외 (단순 피드백 루프).
 */
export async function generateRecommendations(userId: string): Promise<RecRow[]> {
  const sql = getSql();

  const seeds = await sql`
    SELECT t.artist, t.title
    FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
    WHERE ut.user_id = ${userId}
    ORDER BY random() LIMIT 4`;
  if (seeds.length === 0) return [];

  const likedArtists = new Set(
    (
      await sql`
        SELECT DISTINCT lower(t.artist) AS a
        FROM user_tracks ut JOIN tracks t ON t.id = ut.track_id
        WHERE ut.user_id = ${userId}`
    ).map((r) => r.a as string),
  );
  const existing = new Set(
    (
      await sql`
        SELECT lower(artist) || '|' || lower(title) AS k
        FROM recommendations WHERE user_id = ${userId}`
    ).map((r) => r.k as string),
  );
  const dislikedArtists = new Set(
    (
      await sql`
        SELECT DISTINCT lower(artist) AS a
        FROM recommendations WHERE user_id = ${userId} AND rating = 'dislike'`
    ).map((r) => r.a as string),
  );

  // 유사곡 풀 수집
  const pool: { artist: string; title: string; seedTrack: string }[] = [];
  for (const s of seeds) {
    const sims = await lastfmSimilar(s.artist as string, s.title as string);
    for (const sim of sims) {
      pool.push({ ...sim, seedTrack: `${s.artist} - ${s.title}` });
    }
  }

  // 필터 + 중복 제거
  const picked: typeof pool = [];
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

  // Deezer 미리듣기 — 재생 불가 곡은 제외
  const rows: RecRow[] = [];
  for (const c of picked) {
    const d = await searchDeezer(c.artist, c.title);
    if (!d.previewUrl) continue;
    rows.push({
      artist: c.artist,
      title: c.title,
      album: d.album,
      deezerId: d.deezerId,
      previewUrl: d.previewUrl,
      seedTrack: c.seedTrack,
    });
  }
  return rows;
}
