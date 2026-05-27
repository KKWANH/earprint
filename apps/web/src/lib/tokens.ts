/**
 * Generates a token for extension sync (48 hex chars = 192 bits of entropy).
 * Uses Web Crypto — Workers-compatible.
 *
 * SECURITY POSTURE (audit P0-1, May 2026):
 *
 *   ✓ Entropy: 192 bits — brute force is computationally infeasible
 *     (≈ 2^192 operations, well beyond any practical attacker budget).
 *   ✓ Uniqueness: UNIQUE index on users.sync_token, with rotation
 *     immediately overwriting and invalidating the old value.
 *   ✓ Transport: Bearer header over HTTPS only; never in URLs or logs.
 *   ✓ Rate limit: per-token cap enforced inside /api/sync via
 *     user_usage kind='sync' (200 requests/day) — a leaked token
 *     can't burn the global library quota or sustain abuse.
 *
 *   ✗ At-rest: stored as plaintext in users.sync_token. A DB dump or
 *     backup leak would yield directly-usable tokens. Migration to a
 *     hashed-at-rest model requires a one-time-pairing UX so the
 *     extension can receive the plaintext exactly once at issuance —
 *     planned as a follow-up after the P0 sweep. Users can rotate
 *     immediately from /account if a leak is suspected; rotation
 *     overwrites both DB row and the value the extension reads on
 *     its next visit to /connect.
 */
export function generateSyncToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
