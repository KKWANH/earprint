/**
 * MAIN-world script — patches the page's window.fetch to intercept
 * youtubei/v1/browse responses for the Liked Music (LM) playlist only.
 *
 * Only LM responses are captured: otherwise browsing an artist or album page
 * would sweep those (un-liked) tracks into the synced library.
 *
 * content.ts (ISOLATED world) cannot intercept the page's fetch directly,
 * so intercepted JSON is passed via window.postMessage. content.ts may load
 * late and miss the first responses, so they are buffered and re-sent on 'flush'.
 */
(() => {
  const buffer: unknown[] = [];
  const MAX_BUFFER = 60;
  let lastBrowseId = "";
  const post = (data: unknown) =>
    window.postMessage({ __pa: true, kind: "browse", data }, "*");

  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    // Decide at request time whether this targets the Liked Music playlist.
    let isLm = false;
    try {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      if (url.includes("/youtubei/v1/browse")) {
        const init = args[1];
        const body = init && typeof init.body === "string" ? init.body : "";
        if (body) {
          try {
            const parsed = JSON.parse(body) as { browseId?: unknown };
            if (typeof parsed.browseId === "string") lastBrowseId = parsed.browseId;
            // VLLM = the liked-songs playlist. Continuation requests carry no
            // browseId and inherit the most recent browse context.
            isLm = lastBrowseId === "VLLM";
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
          buffer.push(data);
          if (buffer.length > MAX_BUFFER) buffer.shift();
          post(data);
        })
        .catch(() => {});
    }
    return res;
  };

  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { __pa?: boolean; kind?: string } | undefined;
    if (e.source === window && d?.__pa && d.kind === "flush") {
      for (const item of buffer) post(item);
      buffer.length = 0;
    }
  });
})();
