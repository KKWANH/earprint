import { geminiJson } from "./gemini";

/** Unified Gemini analysis — refined genres/moods + audio feel, per track. */
export interface AiAnalysisInput {
  id: string;
  artist: string;
  title: string;
}
export interface AiAnalysisRow {
  trackId: string;
  genres: Record<string, number>;
  moods: Record<string, number>;
  audioFeel: {
    energy: number;
    tempo: number;
    acousticness: number;
    instruments: string[];
  };
  realArtist: string; // "" = no change
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
          energy: { type: "NUMBER" },
          tempo: { type: "NUMBER" },
          acousticness: { type: "NUMBER" },
          instruments: { type: "ARRAY", items: { type: "STRING" } },
          realArtist: { type: "STRING" },
          realTitle: { type: "STRING" },
        },
        required: [
          "id", "genres", "moods", "energy", "tempo", "acousticness",
          "instruments", "realArtist", "realTitle",
        ],
      },
    },
  },
  required: ["results"],
};

const clamp01 = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
};

function toObj(arr: unknown, maxLen: number): Record<string, number> {
  const o: Record<string, number> = {};
  if (Array.isArray(arr)) {
    for (const x of arr) {
      const k = String(x ?? "").toLowerCase().trim();
      if (k && k.length <= maxLen) o[k] = 1;
    }
  }
  return o;
}

/**
 * Analyzes several tracks in one Gemini call. Throws if the call fails so the
 * caller can retry the batch. Whitelisted users pass bypassCap to skip the
 * daily Gemini ceiling.
 */
export async function aiAnalyzeBatch(
  tracks: AiAnalysisInput[],
  bypassCap = false,
): Promise<AiAnalysisRow[]> {
  if (tracks.length === 0) return [];

  const list = tracks.map((t) => `[${t.id}] ${t.artist} — ${t.title}`).join("\n");
  const prompt = `다음 곡들을 너의 음악 지식으로 분석해라. 각 곡마다:
- genres: 이 곡·앨범의 실제 특성을 반영한 구체적 장르 2~5개. 아티스트의 일반 장르로 뭉뚱그리지 말고 해당 곡/앨범 단위로, 하위장르까지 (예: shoegaze, dream pop, city pop, bedroom pop, post-rock, neo-soul). 영문 소문자.
- moods: 정서 1~3개 (영문 소문자: melancholic, dreamy, energetic 등).
- energy: 0(차분·조용) ~ 1(격렬·시끄러움)
- tempo: 0(느림) ~ 1(빠름)
- acousticness: 0(전자음 중심) ~ 1(어쿠스틱·생악기 중심)
- instruments: 두드러진 악기·음색 2~4개 (영문 소문자)
- artist 가 실제 가수·밴드가 아니라 유튜브 채널·모음·커버 계정으로 보이면 title 에서
  realArtist 와 realTitle 을 추출. 올바른 아티스트면 둘 다 빈 문자열("").
- 정말 모르는 곡은 genres·moods 를 빈 배열, 수치는 0.5 근처로.
- id 는 입력 대괄호 안 값을 그대로 사용.

${list}`;

  const parsed = await geminiJson<{ results?: any[] }>(prompt, SCHEMA, { bypassCap });
  const byId = new Map<string, any>();
  for (const r of parsed.results ?? []) {
    if (r?.id) byId.set(String(r.id), r);
  }

  return tracks.map((t) => {
    const r = byId.get(t.id);
    return {
      trackId: t.id,
      genres: toObj(r?.genres, 28),
      moods: toObj(r?.moods, 20),
      audioFeel: {
        energy: clamp01(r?.energy),
        tempo: clamp01(r?.tempo),
        acousticness: clamp01(r?.acousticness),
        instruments: Array.isArray(r?.instruments)
          ? r.instruments
              .map((x: any) => String(x ?? "").toLowerCase().trim())
              .filter((x: string) => x && x.length <= 24)
              .slice(0, 4)
          : [],
      },
      realArtist: typeof r?.realArtist === "string" ? r.realArtist.trim() : "",
      realTitle: typeof r?.realTitle === "string" ? r.realTitle.trim() : "",
    };
  });
}
