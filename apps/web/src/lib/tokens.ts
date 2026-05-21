/** Generates a token for extension sync (48 hex chars). Uses Web Crypto — Workers-compatible. */
export function generateSyncToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
