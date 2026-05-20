/**
 * MAIN world 스크립트 — 페이지의 window.fetch 를 패치해
 * youtubei/v1/browse 응답을 가로챈다.
 *
 * content.ts(ISOLATED world)는 페이지 fetch 를 직접 가로챌 수 없으므로,
 * 가로챈 JSON 을 window.postMessage 로 넘긴다.
 * content.ts 가 늦게 로드되어 초기 응답을 놓칠 수 있으므로 buffer 에 보관하고
 * 'flush' 요청 시 재전송한다.
 */
(() => {
  const buffer: unknown[] = [];
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
    }
  });
})();
