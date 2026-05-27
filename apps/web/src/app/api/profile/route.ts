import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { GEMINI_REGION_ERROR } from "@/lib/gemini";
import { getLocale } from "@/lib/i18n-server";
import { refundCredit, spendCredit } from "@/lib/plan";
import { generateProfile } from "@/lib/profile";
import { newShareId } from "@/lib/share";
import { GEMINI_CAP_ERROR, isWhitelisted } from "@/lib/usage";
import { json } from "@/lib/http";

/** Generates a music psychology/taste profile via Gemini and stores it in taste_profiles. */
export async function POST() {
  let userId: string;
  let aiConsent: boolean;
  try {
    const conn = await ensureConnection();
    userId = conn.userId;
    aiConsent = conn.aiConsent;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  // GDPR Art. 22 — explicit consent required for automated profiling.
  // The /onboarding step asks once; /account exposes a revocable toggle.
  if (!aiConsent) {
    return json({ ok: false, needsAiConsent: true }, 200);
  }

  // Pricing model: Pro = unlimited; free users get 1 starter credit and
  // can buy more at $2 each. spendCredit() is atomic — concurrent retries
  // can't drop credits below zero.
  const ok = await spendCredit(userId);
  if (!ok) {
    return json({ ok: false, needsCredit: true }, 200);
  }

  try {
    const locale = await getLocale();
    const bypassCap = await isWhitelisted(userId);
    // Generate the profile natively in ONLY the user's locale. The other
    // locale's column stays null and is lazily translated by
    // /api/profile/translate when someone (the user themselves, or a
    // share-link viewer) actually needs it. Cost dropped from 2× to 1×
    // gemini-2.5-pro per analysis (~$0.014 vs ~$0.028), and adding a 3rd
    // or 4th UI locale later doesn't multiply that cost — translation
    // through flash-lite is ~40× cheaper than a native re-generation.
    const profile = await generateProfile(userId, locale, bypassCap);
    const sql = getSql();
    // share_id is set once and kept stable so a shared link never breaks.
    // Only the matching locale column gets written this round; the other
    // is left NULL and filled in by the translate route on demand.
    if (locale === "ko") {
      await sql`
        INSERT INTO taste_profiles
          (user_id, ai_profile, ai_profile_ko, ai_generated_at, ai_locale, share_id)
        VALUES (
          ${userId}, ${JSON.stringify(profile)}::jsonb,
          ${JSON.stringify(profile)}::jsonb,
          now(), ${locale}, ${newShareId()})
        ON CONFLICT (user_id) DO UPDATE
          SET ai_profile = EXCLUDED.ai_profile,
              ai_profile_ko = EXCLUDED.ai_profile_ko,
              ai_profile_en = NULL,
              ai_generated_at = now(),
              ai_locale = EXCLUDED.ai_locale,
              share_id = COALESCE(taste_profiles.share_id, EXCLUDED.share_id)`;
    } else {
      await sql`
        INSERT INTO taste_profiles
          (user_id, ai_profile, ai_profile_en, ai_generated_at, ai_locale, share_id)
        VALUES (
          ${userId}, ${JSON.stringify(profile)}::jsonb,
          ${JSON.stringify(profile)}::jsonb,
          now(), ${locale}, ${newShareId()})
        ON CONFLICT (user_id) DO UPDATE
          SET ai_profile = EXCLUDED.ai_profile,
              ai_profile_en = EXCLUDED.ai_profile_en,
              ai_profile_ko = NULL,
              ai_generated_at = now(),
              ai_locale = EXCLUDED.ai_locale,
              share_id = COALESCE(taste_profiles.share_id, EXCLUDED.share_id)`;
    }
    return json({ ok: true }, 200);
  } catch (e) {
    const msg = String(e);
    if (msg.includes(GEMINI_CAP_ERROR)) {
      // Cap is on us, refund so the user isn't charged for a cap they
      // didn't choose to hit.
      await refundCredit(userId);
      return json({ ok: false, capped: true }, 200);
    }
    if (msg.includes(GEMINI_REGION_ERROR)) {
      // Region restriction is also outside the user's control — refund.
      // UI surfaces a "AI service unavailable in your region" message
      // instead of the raw Gemini 400 body.
      await refundCredit(userId);
      return json({ ok: false, regionUnavailable: true }, 200);
    }
    return json({ ok: false, error: String(e) }, 500);
  }
}
