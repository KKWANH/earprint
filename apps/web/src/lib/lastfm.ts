/**
 * Last.fm 태그 → 장르·무드.
 * track.getTopTags 를 먼저 쓰고, 비면 artist.getTopTags 로 폴백(커버리지 보강).
 * 태그 정제: 문장형 개인 태그·아티스트명·연도/연대·중복(k-pop/kpop) 제거.
 */
const API = "https://ws.audioscrobbler.com/2.0/";

const MOOD = new Set([
  "chill", "chillout", "mellow", "relaxing", "calm", "calming", "dreamy",
  "melancholic", "melancholy", "sad", "happy", "upbeat", "energetic", "romantic",
  "dark", "moody", "emotional", "nostalgic", "soothing", "uplifting", "peaceful",
  "sentimental", "bittersweet", "ethereal", "atmospheric", "soft", "intense",
  "fun", "sexy", "smooth", "epic", "haunting", "hopeful", "cheerful", "gloomy",
  "lonely", "feel good", "summer", "night", "groovy", "warm",
]);

const JUNK = new Set([
  "favorites", "favourite", "favourites", "favorite", "seen live", "spotify",
  "love", "loved", "awesome", "beautiful", "amazing", "best", "cool", "good",
  "great", "favorite songs", "favourite songs", "albums i own", "music",
]);

export interface TagResult {
  genres: Record<string, number> | null;
  moods: Record<string, number> | null;
}

interface RawTag {
  name: string;
  count: number;
}

async function fetchTopTags(query: string): Promise<RawTag[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${API}?${query}&api_key=${key}&format=json&autocorrect=1`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    if (!data || data.error) return [];
    let tags = data?.toptags?.tag;
    if (!tags) return [];
    if (!Array.isArray(tags)) tags = [tags];
    return tags.map((t: any) => ({
      name: String(t?.name ?? "").toLowerCase().trim(),
      count: Number(t?.count ?? 0),
    }));
  } catch {
    return [];
  }
}

function classify(tags: RawTag[], artistLower: string): TagResult {
  const genres: Record<string, number> = {};
  const moods: Record<string, number> = {};
  const seen = new Set<string>();
  let gN = 0;
  let mN = 0;

  for (const { name, count } of tags) {
    if (!name) continue;
    if (name.length > 24 || name.split(/\s+/).length > 4) continue; // 문장형 개인 태그
    if (/^\d{4}$/.test(name) || /^\d0s$/.test(name)) continue; // 연도·연대
    if (JUNK.has(name) || name === artistLower) continue;
    const key = name.replace(/[^a-z0-9가-힣]/g, "");
    if (!key || seen.has(key)) continue; // 중복 (k-pop / kpop)
    seen.add(key);

    const weight = Math.max(0.1, Math.min(1, count / 100));
    if (MOOD.has(name)) {
      if (mN < 5) {
        moods[name] = weight;
        mN++;
      }
    } else if (gN < 6) {
      genres[name] = weight;
      gN++;
    }
  }

  return {
    genres: Object.keys(genres).length > 0 ? genres : null,
    moods: Object.keys(moods).length > 0 ? moods : null,
  };
}

export async function getLastfmTags(artist: string, title: string): Promise<TagResult> {
  if (!process.env.LASTFM_API_KEY) return { genres: null, moods: null };
  const artistLower = artist.toLowerCase().trim();

  const trackTags = await fetchTopTags(
    `method=track.gettoptags&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}`,
  );
  let result = classify(trackTags, artistLower);

  // 트랙 태그가 없으면 아티스트 단위 태그로 폴백
  if (!result.genres) {
    const artistTags = await fetchTopTags(
      `method=artist.gettoptags&artist=${encodeURIComponent(artist)}`,
    );
    const fallback = classify(artistTags, artistLower);
    result = {
      genres: result.genres ?? fallback.genres,
      moods: result.moods ?? fallback.moods,
    };
  }
  return result;
}
