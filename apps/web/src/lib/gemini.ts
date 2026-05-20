/** Gemini API — 구조화(JSON) 응답 생성. */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.5-flash";

/**
 * 프롬프트 + 응답 스키마로 JSON 결과를 생성한다.
 * schema 는 Gemini 의 responseSchema (OpenAPI subset, 타입은 대문자).
 */
export async function geminiJson<T>(prompt: string, schema: object): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY 가 설정되지 않았습니다");

  const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.85,
      },
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 300)}`);
  }

  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다");
  return JSON.parse(text) as T;
}
