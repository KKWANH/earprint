/**
 * Deezer 검색 — 무인증·무료. 트랙당 1콜.
 * 앨범·미리듣기·매칭 신뢰도를 얻는다. (BPM·장르는 Deezer 품질이 낮아 사용 안 함)
 */
const API = "https://api.deezer.com";

export interface DeezerMatch {
  deezerId: number | null;
  album: string | null;
  previewUrl: string | null;
  matchConfidence: number;
}

const EMPTY: DeezerMatch = {
  deezerId: null,
  album: null,
  previewUrl: null,
  matchConfidence: 0,
};

async function getJson(url: string): Promise<any> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.error) return null;
    return data;
  } catch {
    return null;
  }
}

/** 매칭/스코어용 정규화: 소문자 + 괄호·feat·기호 제거 (한·일·중 문자 보존). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\bfeat\.?.*$/i, " ")
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+/gi, " ")
    .trim();
}

function scoreMatch(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0.4;
  if (x === y) return 0.95;
  if (x.includes(y) || y.includes(x)) return 0.75;
  return 0.5;
}

export async function searchDeezer(artist: string, title: string): Promise<DeezerMatch> {
  const cleanTitle = norm(title) || title;
  const advanced = `artist:"${artist.replace(/"/g, "")}" track:"${cleanTitle}"`;

  let data = await getJson(`${API}/search?q=${encodeURIComponent(advanced)}&limit=1`);
  let hit = data?.data?.[0];
  if (!hit) {
    data = await getJson(`${API}/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`);
    hit = data?.data?.[0];
  }
  if (!hit) return EMPTY;

  return {
    deezerId: hit.id ?? null,
    album: hit.album?.title ?? null,
    previewUrl: hit.preview || null,
    matchConfidence: scoreMatch(title, hit.title ?? ""),
  };
}
