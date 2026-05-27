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
 * Parse a request body as JSON with a hard byte cap.
 *
 * Cloudflare Workers' default ingress lets bodies grow up to 100MB on paid
 * plans — without an app-level cap a single malicious request could OOM
 * the isolate or stall the JSON parser. This helper checks Content-Length
 * first (cheap reject for honest clients), then re-validates against the
 * actual streamed bytes (clients can lie about Content-Length).
 *
 * Returns a discriminated union so callers can `return r.response` directly
 * without losing CORS headers — pass them via `extraHeaders`.
 *
 *   const r = await readJsonBody<MyBody>(req, 64 * 1024, CORS);
 *   if (!r.ok) return r.response;
 *   const body = r.data;
 */
export async function readJsonBody<T>(
  req: Request,
  maxBytes: number,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  // 1. Cheap reject when the client honestly declares an oversized body.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    return {
      ok: false,
      response: json({ error: "payload too large" }, 413, extraHeaders),
    };
  }
  // 2. Read the stream ourselves so a lying Content-Length can't slip past.
  //    `.arrayBuffer()` is fine here — the body is bounded by step 3 below.
  let bytes: Uint8Array;
  try {
    const buf = await req.arrayBuffer();
    bytes = new Uint8Array(buf);
  } catch {
    return {
      ok: false,
      response: json({ error: "invalid body" }, 400, extraHeaders),
    };
  }
  if (bytes.byteLength > maxBytes) {
    return {
      ok: false,
      response: json({ error: "payload too large" }, 413, extraHeaders),
    };
  }
  // 3. Decode + parse. Empty body is treated as `{}` so route-level
  //    schema validation can produce the right error message.
  try {
    const text = new TextDecoder().decode(bytes);
    const data = (text === "" ? {} : JSON.parse(text)) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: json({ error: "invalid json" }, 400, extraHeaders),
    };
  }
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
