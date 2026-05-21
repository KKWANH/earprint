/**
 * MAIN-world script — captures the liked-songs list deterministically.
 *
 * Instead of scrolling the UI, it captures one real youtubei/v1/browse request
 * the page makes on the Liked Music page (its URL, headers and context), then
 * on "harvest" replays continuation requests back-to-back until the list ends.
 * Fast (seconds, not minutes), complete, and LM-only by construction.
 *
 * A browse response is treated as LM only if the request fired while the URL
 * is the liked-songs playlist — so browsing artist/album pages can't pollute it.
 */
(() => {
  let tmpl: { url: string; headers: Record<string, string>; context: unknown } | null = null;
  let firstResponse: unknown = null;
  const buffer: unknown[] = []; // for the scroll fallback's flush
  const MAX_BUFFER = 80;

  const post = (msg: object) => window.postMessage({ __pa: true, ...msg }, "*");
  const onLikedPage = () => location.href.includes("list=LM");

  function headersToObject(h: HeadersInit | undefined): Record<string, string> {
    const o: Record<string, string> = {};
    if (!h) return o;
    if (h instanceof Headers) h.forEach((v, k) => { o[k] = v; });
    else if (Array.isArray(h)) for (const [k, v] of h) o[k] = v;
    else Object.assign(o, h as Record<string, string>);
    return o;
  }

  /** Depth-first find the next continuation token in a browse response. */
  function findToken(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const c of node) {
        const t = findToken(c);
        if (t) return t;
      }
      return null;
    }
    const obj = node as Record<string, unknown>;
    const cmd = obj["continuationCommand"] as { token?: unknown } | undefined;
    if (cmd && typeof cmd.token === "string") return cmd.token;
    const ncd = obj["nextContinuationData"] as { continuation?: unknown } | undefined;
    if (ncd && typeof ncd.continuation === "string") return ncd.continuation;
    for (const k of Object.keys(obj)) {
      const t = findToken(obj[k]);
      if (t) return t;
    }
    return null;
  }

  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    let isLm = false;
    try {
      const input = args[0];
      const url =
        typeof input === "string" ? input
        : input instanceof Request ? input.url
        : String(input);
      if (url.includes("/youtubei/v1/browse") && onLikedPage()) {
        isLm = true;
        const init = args[1];
        const bodyStr = init && typeof init.body === "string" ? init.body : "";
        if (bodyStr && !tmpl) {
          try {
            const body = JSON.parse(bodyStr) as { context?: unknown };
            if (body.context && init) {
              tmpl = { url, headers: headersToObject(init.headers), context: body.context };
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }

    const res = await origFetch.apply(this, args);
    if (isLm) {
      res
        .clone()
        .json()
        .then((data: unknown) => {
          if (!firstResponse) firstResponse = data;
          buffer.push(data);
          if (buffer.length > MAX_BUFFER) buffer.shift();
          post({ kind: "browse", data });
        })
        .catch(() => {});
    }
    return res;
  };

  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { __pa?: boolean; kind?: string } | undefined;
    if (e.source !== window || !d?.__pa) return;

    if (d.kind === "flush") {
      for (const item of buffer) post({ kind: "browse", data: item });
      return;
    }

    if (d.kind === "harvest") {
      void (async () => {
        if (!tmpl || !firstResponse) {
          post({ kind: "harvestDone", ok: false });
          return;
        }
        let token = findToken(firstResponse);
        let pages = 1;
        while (token && pages < 200) {
          try {
            const res = await origFetch.call(window, tmpl.url, {
              method: "POST",
              headers: { ...tmpl.headers, "content-type": "application/json" },
              body: JSON.stringify({ context: tmpl.context, continuation: token }),
              credentials: "include",
            });
            if (!res.ok) break;
            const data = (await res.json()) as unknown;
            post({ kind: "browse", data });
            pages++;
            token = findToken(data);
            await new Promise((r) => setTimeout(r, 120));
          } catch {
            break;
          }
        }
        post({ kind: "harvestDone", ok: true, pages });
      })();
    }
  });
})();
