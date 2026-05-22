import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { generateProfile } from "@/lib/profile";
import { json } from "@/lib/http";

/** Generates a music psychology/taste profile via Gemini and stores it in taste_profiles. */
export async function POST() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const locale = await getLocale();
    const profile = await generateProfile(userId, locale);
    const sql = getSql();
    await sql`
      INSERT INTO taste_profiles (user_id, ai_profile, ai_generated_at, ai_locale)
      VALUES (${userId}, ${JSON.stringify(profile)}::jsonb, now(), ${locale})
      ON CONFLICT (user_id) DO UPDATE
        SET ai_profile = EXCLUDED.ai_profile,
            ai_generated_at = now(),
            ai_locale = EXCLUDED.ai_locale`;
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
