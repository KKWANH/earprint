/**
 * Sync-token issuance + verification helpers.
 *
 * SECURITY POSTURE (post-hash migration, May 2026):
 *
 *   ✓ Entropy: 192 bits — brute force is computationally infeasible
 *     (≈ 2^192 operations, well beyond any practical attacker budget).
 *   ✓ Uniqueness: UNIQUE index on users.sync_token (legacy) AND on
 *     users.sync_token_hash (current). Rotation overwrites both.
 *   ✓ Transport: Bearer header over HTTPS only; never in URLs or logs.
 *   ✓ Rate limit: per-token cap enforced inside /api/sync via
 *     user_usage kind='sync' (200 requests/day) — a leaked token
 *     can't burn the global library quota or sustain abuse.
 *
 *   ▴ At-rest: in transition. Newly issued tokens have
 *     sync_token_hash populated; legacy rows still carry plaintext
 *     until they're verified once (the verify path back-fills the
 *     hash). After every active row has a hash, a follow-up commit
 *     will drop the plaintext column.
 *
 * Hash scheme: HMAC-SHA256(secret, token). Deterministic so we can
 * index it (single-row lookup) and keep the request path O(1)
 * instead of O(N) scan-and-compare you'd need with bcrypt/Argon2.
 * Single-secret leak compromises every token at once — accepted
 * because the secret lives in Cloudflare's secret store, NOT in
 * the DB dump that would otherwise be the attack surface.
 */

const HMAC_ALGO = { name: "HMAC", hash: "SHA-256" } as const;

export function generateSyncToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Reads the HMAC secret from env. Falls back to a development-only
 *  default so local runs don't crash; prod MUST set the env var
 *  (otherwise every hash matches across the deploy fleet, defeating
 *  the point of the migration). */
function getHmacSecret(): string {
  const s = process.env.SYNC_TOKEN_HMAC_SECRET;
  if (s && s.length >= 16) return s;
  // Dev fallback. Loud warning so prod misconfig is obvious.
  if (typeof console !== "undefined") {
    console.warn(
      "[tokens] SYNC_TOKEN_HMAC_SECRET missing or too short — using DEV fallback. Set a 32+ char secret in production.",
    );
  }
  return "earprint-dev-only-do-not-use-in-production";
}

let cachedKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getHmacSecret()),
    HMAC_ALGO,
    false,
    ["sign"],
  );
  cachedKey = key;
  return key;
}

/**
 * Hashes a sync token for at-rest storage / index lookup. Hex-encoded
 * 64-char SHA-256 output. Pure function of (secret, token) — same
 * input always produces same output, so the result is suitable as a
 * primary-key-like value the DB can index and compare with O(1).
 */
export async function hashSyncToken(token: string): Promise<string> {
  const key = await getKey();
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign(HMAC_ALGO, key, enc.encode(token));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two equal-length hex strings. Use when
 * comparing a computed hash against a DB-stored hash, even though the
 * DB lookup itself is by indexed equality — defensive habit.
 */
export function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
