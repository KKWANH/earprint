import { getSql } from "./db";

/**
 * A short, unguessable id for a public share link (/s/<id>).
 *
 * 16 hex chars = 64 bits of entropy. Birthday-paradox collision becomes
 * possible around 2^32 ≈ 4 billion IDs — comfortably more than we'll
 * ever issue. The previous 12-char (48-bit) ID would have started
 * colliding around 2^24 = 16 million, which is at-best-marginal for a
 * sharing-friendly URL where collisions silently overwrite each other.
 *
 * Still short enough to paste into a tweet / DM (16 chars + the /s/
 * prefix = 19 chars).
 */
export function newShareId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * "Top N%" for a digging score — the share of profiles scoring at or above it.
 * Returns null until there are enough profiles for the figure to be meaningful.
 */
export async function diggingPercentile(score: number): Promise<number | null> {
  const sql = getSql();
  try {
    const r = await sql`
      SELECT count(*)::int AS total,
             count(*) FILTER (
               WHERE (ai_profile ->> 'diggingScore')::int >= ${score}
             )::int AS at_or_above
      FROM taste_profiles
      WHERE ai_profile IS NOT NULL`;
    const total = r[0].total as number;
    if (total < 20) return null; // too few profiles to be meaningful
    const pct = Math.round(((r[0].at_or_above as number) / total) * 100);
    return Math.min(99, Math.max(1, pct));
  } catch {
    return null;
  }
}
