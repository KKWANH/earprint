import { geminiJson } from "./gemini";

const SCHEMA = {
  type: "OBJECT",
  properties: { blurb: { type: "STRING" } },
  required: ["blurb"],
};

/** A short Korean blurb on a track's background and musical significance. */
export async function generateBlurb(artist: string, title: string): Promise<string> {
  const prompt = `"${artist} - ${title}" 라는 곡을 한국어 2~3문장으로 짧게 소개해라.
- 발표 시기나 아티스트 맥락 등 간단한 역사
- 음악사적·문화적 의미나 특징 (있다면)
- 사실에 근거할 것. 모르는 곡이면 추측 대신 장르적 특징 위주로.
- 광고 문구가 아니라 담백한 소개체로.`;
  const r = await geminiJson<{ blurb: string }>(prompt, SCHEMA);
  return r.blurb;
}
