import { getSql } from "./db";

/**
 * Global daily ceiling on paid Gemini calls. A public launch (e.g. shared on
 * LinkedIn) could otherwise run cost away — once the cap is hit, callers show
 * a friendly "try again tomorrow" message instead of spending more.
 */
const GEMINI_DAILY_CAP = 3000;

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

/** Records one Gemini call against today's counter. Best-effort. */
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
