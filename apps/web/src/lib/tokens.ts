/** 확장 동기화용 토큰 생성 (48 hex chars). Web Crypto 사용 — Workers 호환. */
export function generateSyncToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
