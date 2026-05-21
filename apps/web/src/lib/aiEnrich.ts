import { geminiJson } from "./gemini";

/** Enriches tracks whose genres the APIs couldn't fill, using Gemini's knowledge. */
export interface AiEnrichInput {
  id: string;
  artist: string;
  title: string;
}
export interface AiEnrichRow {
  trackId: string;
  genres: Record<string, number>;
  moods: Record<string, number>;
  realArtist: string; // "" means no change
  realTitle: string;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          genres: { type: "ARRAY", items: { type: "STRING" } },
          moods: { type: "ARRAY", items: { type: "STRING" } },
          realArtist: { type: "STRING" },
          realTitle: { type: "STRING" },
        },
        required: ["id", "genres", "moods", "realArtist", "realTitle"],
      },
    },
  },
  required: ["results"],
};

function toObj(arr: unknown): Record<string, number> {
  const o: Record<string, number> = {};
  if (!Array.isArray(arr)) return o;
  for (const x of arr) {
    const k = String(x ?? "").toLowerCase().trim();
    if (k && k.length <= 30) o[k] = 1;
  }
  return o;
}

/**
 * Enriches multiple tracks in a single Gemini call.
 * Throws if the Gemini call itself fails — letting the caller retry the batch.
 * (If it succeeds but skips some tracks, fills them with empty results to avoid an infinite loop.)
 */
export async function aiEnrichBatch(tracks: AiEnrichInput[]): Promise<AiEnrichRow[]> {
  if (tracks.length === 0) return [];

  const list = tracks.map((t) => `[${t.id}] ${t.artist} — ${t.title}`).join("\n");
  const prompt = `다음 음악 트랙들의 장르/무드를 너의 음악 지식으로 채워라.

규칙:
- 각 곡마다 genres 2~4개(영문 소문자 장르명), moods 1~3개를 채운다.
- artist 가 실제 가수/밴드가 아니라 유튜브 채널·노래모음·커버·플레이리스트 계정으로
  보이면, title 에서 진짜 원곡 아티스트를 realArtist, 원곡명을 realTitle 로 추출한다.
- artist 가 이미 올바른 가수/밴드면 realArtist 와 realTitle 은 빈 문자열("").
- 정말 모르는 곡은 genres·moods 를 빈 배열로 둔다 (추측 금지).
- 응답의 id 는 입력의 대괄호 안 값을 그대로 쓴다.

트랙 목록:
${list}`;

  const parsed = await geminiJson<{ results?: any[] }>(prompt, SCHEMA);

  const byId = new Map<string, any>();
  for (const r of parsed.results ?? []) {
    if (r?.id) byId.set(String(r.id), r);
  }

  // Return a row for every input track (missing ones get empty results — prevents retry infinite loops).
  return tracks.map((t) => {
    const r = byId.get(t.id);
    return {
      trackId: t.id,
      genres: toObj(r?.genres),
      moods: toObj(r?.moods),
      realArtist: typeof r?.realArtist === "string" ? r.realArtist.trim() : "",
      realTitle: typeof r?.realTitle === "string" ? r.realTitle.trim() : "",
    };
  });
}
