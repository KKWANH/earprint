import { getSql } from "./db";

/**
 * Global daily ceiling on paid Gemini calls. A public launch (e.g. shared on
 * LinkedIn) could otherwise run cost away — once the cap is hit, callers show
 * a friendly "try again tomorrow" message instead of spending more.
 */
const GEMINI_DAILY_CAP = 3000;

/**
 * Per-user daily ceiling. Without this, one authenticated user could
 * drain the global cap themselves by re-triggering analysis and
 * translation in a loop. 200 covers the heaviest legitimate session
 * (~17 ai-analysis batches for a 500-track library + profile + several
 * translations + a handful of genre describes), with margin. Whitelisted
 * users bypass both this and the global cap.
 */
const GEMINI_PER_USER_DAILY_CAP = 200;

/** Thrown by geminiJson when the daily cap is hit; recognised by callers. */
export const GEMINI_CAP_ERROR = "GEMINI_DAILY_CAP";

/** True once today's Gemini call budget is exhausted. */
export async function geminiOverCap(): Promise<boolean> {
  const sql = getSql();
  try {
    const r = await sql`
      SELECT count FROM api_usage WHERE day = current_date AND kind = 'gemini'`;
    return r.length > 0 && (r[0].count as number) >= GEMINI_DAILY_CAP;
  } catch {
    return false; // never block on a counter failure
  }
}

/** True once this user's daily Gemini budget is exhausted. */
export async function geminiOverUserCap(userId: string): Promise<boolean> {
  const sql = getSql();
  try {
    const r = await sql`
      SELECT count FROM user_usage
       WHERE user_id = ${userId} AND kind = 'gemini' AND usage_date = current_date`;
    return r.length > 0 && (r[0].count as number) >= GEMINI_PER_USER_DAILY_CAP;
  } catch {
    return false;
  }
}

/** Records one Gemini call against today's GLOBAL counter. Best-effort. */
export async function recordGemini(): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO api_usage (day, kind, count) VALUES (current_date, 'gemini', 1)
      ON CONFLICT (day, kind) DO UPDATE SET count = api_usage.count + 1`;
  } catch {
    /* best-effort */
  }
}

/** Records one Gemini call against this user's daily counter. Best-effort. */
export async function recordGeminiForUser(userId: string): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO user_usage (user_id, kind, usage_date, count)
      VALUES (${userId}, 'gemini', current_date, 1)
      ON CONFLICT (user_id, kind, usage_date)
      DO UPDATE SET count = user_usage.count + 1`;
  } catch {
    /* best-effort */
  }
}

/**
 * True if the user's email is on the whitelist — those accounts bypass the
 * daily Gemini cap entirely (the owner and trusted users always have access).
 */
export async function isWhitelisted(userId: string): Promise<boolean> {
  const sql = getSql();
  try {
    const r = await sql`
      SELECT 1 FROM app_whitelist w
      JOIN users u ON lower(u.email) = w.email
      WHERE u.id = ${userId}`;
    return r.length > 0;
  } catch {
    return false;
  }
}
