import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { generateProfile, translateProfile } from "@/lib/profile";
import { newShareId } from "@/lib/share";
import { GEMINI_CAP_ERROR, isWhitelisted } from "@/lib/usage";
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
    const bypassCap = await isWhitelisted(userId);
    // Generate once, then translate — the profile is stored in both languages
    // so switching the UI language later needs no Gemini call.
    const profile = await generateProfile(userId, locale, bypassCap);
    const translated = await translateProfile(
      profile,
      locale === "ko" ? "en" : "ko",
      bypassCap,
    );
    const en = locale === "en" ? profile : translated;
    const ko = locale === "ko" ? profile : translated;
    const sql = getSql();
    // share_id is set once and kept stable so a shared link never breaks.
    await sql`
      INSERT INTO taste_profiles
        (user_id, ai_profile, ai_profile_en, ai_profile_ko,
         ai_generated_at, ai_locale, share_id)
      VALUES (
        ${userId}, ${JSON.stringify(profile)}::jsonb,
        ${JSON.stringify(en)}::jsonb, ${JSON.stringify(ko)}::jsonb,
        now(), ${locale}, ${newShareId()})
      ON CONFLICT (user_id) DO UPDATE
        SET ai_profile = EXCLUDED.ai_profile,
            ai_profile_en = EXCLUDED.ai_profile_en,
            ai_profile_ko = EXCLUDED.ai_profile_ko,
            ai_generated_at = now(),
            ai_locale = EXCLUDED.ai_locale,
            share_id = COALESCE(taste_profiles.share_id, EXCLUDED.share_id)`;
    return json({ ok: true }, 200);
  } catch (e) {
    if (String(e).includes(GEMINI_CAP_ERROR)) {
      return json({ ok: false, capped: true }, 200);
    }
    return json({ ok: false, error: String(e) }, 500);
  }
}
