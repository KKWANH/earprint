import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { captureError } from "@/lib/sentry";
import { aiJson } from "@/lib/ai";
import type { AiProfile } from "@/lib/profile";

/**
 * Lazy translate of a stored AI profile to a different locale.
 *
 * Why this exists: /api/profile generates only in the user's primary
 * locale (saves ~half the Gemini 2.5-pro cost). When the user later
 * switches UI language, or someone with a different locale opens the
 * share link, we hit this endpoint to fill in the missing column —
 * but via gemini-2.0-flash-lite (~$0.0007/call), not a native regen.
 *
 * The translation prompt asks for *only* the user-visible text strings,
 * leaving numeric fields (diggingScore etc.) untouched. We pass the
 * JSON in and back out so column shapes match.
 */

const VALID_TARGETS = new Set(["en", "ko"]);

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{ target?: string; shareId?: string }>(
    req,
    1024,
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const target = String(body.target ?? "").trim();
  if (!VALID_TARGETS.has(target)) {
    return json({ error: "target must be en or ko" }, 400);
  }
  const targetCol = target === "ko" ? "ai_profile_ko" : "ai_profile_en";
  const sourceCol = target === "ko" ? "ai_profile_en" : "ai_profile_ko";

  const sql = getSql();

  // Fetch the row. If `shareId` was provided, that key wins (someone
  // viewing a share link in a different locale than the owner). Else,
  // own row.
  const rows = body.shareId
    ? await sql`
        SELECT ai_profile_en, ai_profile_ko, ai_profile
        FROM taste_profiles WHERE share_id = ${body.shareId}`
    : await sql`
        SELECT ai_profile_en, ai_profile_ko, ai_profile
        FROM taste_profiles WHERE user_id = ${userId}::uuid`;
  if (rows.length === 0) {
    return json({ error: "profile not found" }, 404);
  }
  const row = rows[0]!;

  // If the target column is already populated, return immediately —
  // someone else may have translated since the caller queried. Don't
  // burn another Gemini call.
  const existing = row[targetCol] as AiProfile | null;
  if (existing) {
    return json({ ok: true, profile: existing, cached: true }, 200);
  }

  // Source: prefer the explicit other-locale column, fall back to the
  // canonical ai_profile column (older rows had only this).
  const source =
    (row[sourceCol] as AiProfile | null) ??
    (row.ai_profile as AiProfile | null);
  if (!source) {
    return json({ error: "no source profile to translate" }, 404);
  }

  const targetLangName = target === "ko" ? "Korean" : "English";
  const prompt =
    `Translate the user-visible text fields of the following AI music ` +
    `profile JSON to ${targetLangName}. ` +
    `Translate ONLY: persona.name, persona.archetype, persona.tagline, ` +
    `headline, personality, traits[], moodProfile, favoriteGenres[], ` +
    `avoidedGenres[], unexploredGenres[], diggingComment, improvementTips[]. ` +
    `Leave numeric fields (diggingScore) and persona.emoji untouched. ` +
    `Keep the same JSON shape. Natural fluent ${targetLangName}, not ` +
    `word-for-word literal.\n\n${JSON.stringify(source)}`;

  // Same schema shape as the source — the model fills out the matching
  // structure. We tolerate minor drift (extra fields) by passing through.
  const SCHEMA = {
    type: "OBJECT",
    properties: {
      profile: {
        type: "OBJECT",
        // Gemini's responseSchema requires properties to be enumerated —
        // we only enforce a non-empty result, leaving inner shape to the
        // server-side validation on read.
      },
    },
    required: ["profile"],
  };

  let translated: AiProfile;
  try {
    const raw = (await aiJson<{ profile?: AiProfile }>(prompt, SCHEMA, {
      model: process.env.GEMINI_MODEL_TRANSLATE ?? "gemini-2.0-flash-lite",
      userId,
    })) as { profile?: AiProfile };
    if (!raw.profile) throw new Error("missing profile field");
    translated = raw.profile;
  } catch (e) {
    captureError(e, { tag: "profile.translate", extra: { target } });
    return json({ ok: false, error: String(e) }, 500);
  }

  // Cache via parameterised UPDATE. Four branches (locale × source key)
  // instead of clever sql-fragment-in-fragment interpolation — keeps
  // each statement obviously parameterised at a glance, and the cost
  // of two extra lines beats a debugging session over Neon template
  // semantics if nested fragments ever silently mis-bind.
  try {
    if (target === "ko" && body.shareId) {
      await sql`
        UPDATE taste_profiles SET ai_profile_ko = ${JSON.stringify(translated)}::jsonb
        WHERE share_id = ${body.shareId}`;
    } else if (target === "ko") {
      await sql`
        UPDATE taste_profiles SET ai_profile_ko = ${JSON.stringify(translated)}::jsonb
        WHERE user_id = ${userId}::uuid`;
    } else if (target === "en" && body.shareId) {
      await sql`
        UPDATE taste_profiles SET ai_profile_en = ${JSON.stringify(translated)}::jsonb
        WHERE share_id = ${body.shareId}`;
    } else {
      await sql`
        UPDATE taste_profiles SET ai_profile_en = ${JSON.stringify(translated)}::jsonb
        WHERE user_id = ${userId}::uuid`;
    }
  } catch (e) {
    captureError(e, { tag: "profile.translate.cache" });
    // Translation succeeded but caching failed — still return the result
    // so the caller can render it; next request just re-translates.
  }

  return json({ ok: true, profile: translated, cached: false }, 200);
}
