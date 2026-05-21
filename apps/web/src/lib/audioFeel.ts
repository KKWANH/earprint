import { geminiJson } from "./gemini";

/** Gemini-estimated listening characteristics for a track. */
export interface AudioFeel {
  energy: number; // 0 = calm/quiet, 1 = intense/loud
  tempo: number; // 0 = slow, 1 = fast
  acousticness: number; // 0 = electronic, 1 = acoustic
  instruments: string[];
}
export interface AudioFeelInput {
  id: string;
  artist: string;
  title: string;
}
export interface AudioFeelRow {
  trackId: string;
  audioFeel: AudioFeel;
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
          energy: { type: "NUMBER" },
          tempo: { type: "NUMBER" },
          acousticness: { type: "NUMBER" },
          instruments: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["id", "energy", "tempo", "acousticness", "instruments"],
      },
    },
  },
  required: ["results"],
};

const clamp01 = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
};

/**
 * Estimates listening characteristics for several tracks in one Gemini call.
 * Throws if the Gemini call fails (so the caller can retry the batch).
 */
export async function audioFeelBatch(tracks: AudioFeelInput[]): Promise<AudioFeelRow[]> {
  if (tracks.length === 0) return [];

  const list = tracks.map((t) => `[${t.id}] ${t.artist} — ${t.title}`).join("\n");
  const prompt = `다음 곡들의 청취 느낌을 너의 음악 지식으로 추정해라. 각 곡마다:
- energy: 0(차분·조용) ~ 1(격렬·시끄러움)
- tempo: 0(느림) ~ 1(빠름)
- acousticness: 0(전자음 중심) ~ 1(어쿠스틱·생악기 중심)
- instruments: 두드러진 악기·음색 2~4개 (영문 소문자: piano, synth, guitar, strings, drums, vocal 등)
모르는 곡은 0.5 근처로 보수적으로 추정. id 는 입력 대괄호 안 값을 그대로 사용.

${list}`;

  const parsed = await geminiJson<{ results?: any[] }>(prompt, SCHEMA);
  const byId = new Map<string, any>();
  for (const r of parsed.results ?? []) {
    if (r?.id) byId.set(String(r.id), r);
  }

  return tracks.map((t) => {
    const r = byId.get(t.id);
    return {
      trackId: t.id,
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
    };
  });
}
