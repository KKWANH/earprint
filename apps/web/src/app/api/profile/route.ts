import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { generateProfile } from "@/lib/profile";

/** Gemini 로 음악 심리·취향 프로파일을 생성해 taste_profiles 에 저장한다. */
export async function POST() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const profile = await generateProfile(userId);
    const sql = getSql();
    await sql`
      INSERT INTO taste_profiles (user_id, ai_profile, ai_generated_at)
      VALUES (${userId}, ${JSON.stringify(profile)}::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE
        SET ai_profile = EXCLUDED.ai_profile, ai_generated_at = now()`;
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
