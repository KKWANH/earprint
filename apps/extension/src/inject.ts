/**
 * MAIN-world script — patches the page's window.fetch to intercept
 * youtubei/v1/browse responses.
 *
 * content.ts (ISOLATED world) cannot intercept the page's fetch directly,
 * so intercepted JSON is passed via window.postMessage. content.ts may load
 * late and miss the first responses, so they are buffered and re-sent on 'flush'.
 */
(() => {
  const buffer: unknown[] = [];
  const MAX_BUFFER = 60; // cap so a long session can't grow this unbounded
  const post = (data: unknown) =>
    window.postMessage({ __pa: true, kind: "browse", data }, "*");

  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await origFetch.apply(this, args);
    try {
      const input = args[0];
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      if (url.includes("/youtubei/v1/browse")) {
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
    } catch {
      /* ignore */
    }
    return res;
  };

  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { __pa?: boolean; kind?: string } | undefined;
    if (e.source === window && d?.__pa && d.kind === "flush") {
      for (const item of buffer) post(item);
      buffer.length = 0; // buffer has done its job once flushed
    }
  });
})();
