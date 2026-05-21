/** Shared HTTP helpers for API routes and outbound API calls. */

/** Build a JSON Response with optional extra headers (e.g. CORS). */
export function json(
  data: unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

/**
 * Fetch JSON with a timeout. Returns null on any failure, a non-OK status,
 * or a response carrying a top-level `error` field (the convention used by
 * Deezer and Last.fm). Never throws.
 */
export async function getJson(url: string, timeoutMs = 6000): Promise<any> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.error) return null;
    return data;
  } catch {
    return null;
  }
}
