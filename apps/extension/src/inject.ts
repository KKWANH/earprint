/**
 * MAIN-world script — collects the liked-songs list by scrolling the real
 * YouTube Music UI and reading every row as it renders.
 *
 * Why DOM scraping (not InnerTube continuation replay):
 * the continuation token chain is opaque and terminated early. Scrolling lets
 * YouTube's own UI request the correct continuations; we then read each
 * rendered row's bound renderer object (`.data`, reachable only from the MAIN
 * world). The list is virtualized, so every row is read on the scroll step
 * where it is mounted.
 *
 * The page's fetch is also patched so any browse responses flying by during
 * the scroll are captured too — redundant coverage, costs nothing.
 */
(() => {
  const post = (msg: object) => window.postMessage({ __pa: true, ...msg }, "*");
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const onLikedPage = () => location.href.includes("list=LM");

  // ── Secondary capture: intercept browse responses during the scroll ──
  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    let isLm = false;
    try {
      const input = args[0];
      const url =
        typeof input === "string" ? input
        : input instanceof Request ? input.url
        : String(input);
      if (url.includes("/youtubei/v1/browse") && onLikedPage()) isLm = true;
    } catch {
      /* ignore */
    }
    const res = await origFetch.apply(this, args);
    if (isLm) {
      res
        .clone()
        .json()
        .then((data: unknown) => post({ kind: "browse", data }))
        .catch(() => {});
    }
    return res;
  };

  /** The renderer object Polymer bound to a list-item element. */
  function rendererOf(el: Element): unknown {
    const any = el as unknown as Record<string, unknown>;
    return (
      any.data ??
      (any.__data as Record<string, unknown> | undefined)?.data ??
      (any.polymerController as Record<string, unknown> | undefined)?.data ??
      (any.inst as Record<string, unknown> | undefined)?.data ??
      null
    );
  }

  /** Depth-first find a videoId — used only to count unique rows. */
  function pickVideoId(node: unknown): string | null {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const c of node) {
        const v = pickVideoId(c);
        if (v) return v;
      }
      return null;
    }
    const o = node as Record<string, unknown>;
    const pid = o.playlistItemData as { videoId?: unknown } | undefined;
    if (pid && typeof pid.videoId === "string") return pid.videoId;
    const we = o.watchEndpoint as { videoId?: unknown } | undefined;
    if (we && typeof we.videoId === "string") return we.videoId;
    for (const k of Object.keys(o)) {
      const v = pickVideoId(o[k]);
      if (v) return v;
    }
    return null;
  }

  /** Fallback — parse a row straight from the DOM when `.data` is absent. */
  function fromDomText(
    row: Element,
  ): { videoId: string; title: string; artist: string; album?: string } | null {
    let videoId = "";
    for (const a of Array.from(row.querySelectorAll('a[href*="watch?v="]'))) {
      const m = (a.getAttribute("href") || "").match(/[?&]v=([^&]+)/);
      if (m && m[1]) {
        videoId = decodeURIComponent(m[1]);
        break;
      }
    }
    if (!videoId) return null;
    const title = (row.querySelector(".title")?.textContent || "").trim();
    if (!title) return null;
    // The liked-songs table renders Title / Artist / Album as flex columns.
    const cols = row.querySelectorAll("yt-formatted-string.flex-column");
    const seg = (i: number) =>
      ((cols[i]?.textContent || "").split("•")[0] || "").trim();
    const artist = seg(1) || "Unknown";
    const album = seg(2);
    const track: { videoId: string; title: string; artist: string; album?: string } = {
      videoId,
      title,
      artist,
    };
    if (album && album !== artist) track.album = album;
    return track;
  }

  /** Finds the element that actually scrolls the playlist. */
  function findScroller(): HTMLElement {
    let el: HTMLElement | null = document.querySelector(
      "ytmusic-responsive-list-item-renderer",
    );
    while (el) {
      const p: HTMLElement | null = el.parentElement;
      if (!p) break;
      if (p.scrollHeight > p.clientHeight + 80) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === "auto" || oy === "scroll") return p;
      }
      el = p;
    }
    return (document.scrollingElement as HTMLElement) || document.documentElement;
  }

  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { __pa?: boolean; kind?: string } | undefined;
    if (e.source !== window || !d?.__pa || d.kind !== "scrape") return;

    void (async () => {
      const seen = new Set<string>();
      let domPeak = 0;

      const scrapeNow = () => {
        const rows = Array.from(
          document.querySelectorAll("ytmusic-responsive-list-item-renderer"),
        );
        if (rows.length > domPeak) domPeak = rows.length;
        for (const row of rows) {
          const data = rendererOf(row);
          if (data && typeof data === "object") {
            post({ kind: "browse", data: { musicResponsiveListItemRenderer: data } });
            const id = pickVideoId(data);
            if (id) seen.add(id);
          } else {
            const t = fromDomText(row);
            if (t) {
              post({ kind: "domTrack", track: t });
              seen.add(t.videoId);
            }
          }
        }
      };

      const lastRow = () => {
        const rows = document.querySelectorAll("ytmusic-responsive-list-item-renderer");
        return rows[rows.length - 1] as HTMLElement | undefined;
      };

      // YouTube's "load more" sentinel. While this element exists the list
      // still has more pages; when it is gone the list has truly ended.
      const moreToLoad = () =>
        document.querySelector("ytmusic-continuation-item-renderer") != null ||
        document.querySelector(
          "tp-yt-paper-spinner[active], tp-yt-paper-spinner-lite[active]",
        ) != null;

      // Start from the very top so nothing above the initial view is missed.
      findScroller().scrollTop = 0;
      window.scrollTo(0, 0);
      await sleep(900);
      scrapeNow();

      // Smooth crawl downward — small, overlapping steps so the virtualised
      // list always renders the rows between two reads. No jarring jumps.
      let stall = 0;
      let lastSize = 0;
      for (let i = 0; i < 12000 && stall < 30; i++) {
        scrapeNow();
        const scroller = findScroller();
        const stepPx = Math.max(360, scroller.clientHeight * 0.7);
        scroller.scrollTop += stepPx;
        window.scrollBy(0, stepPx);
        if (stall > 0) lastRow()?.scrollIntoView({ block: "end" }); // nudge when stuck

        await sleep(stall > 0 ? 600 : 240);
        scrapeNow();

        if (seen.size > lastSize) {
          stall = 0;
          lastSize = seen.size;
        } else {
          stall++;
        }
        post({ kind: "scrapeProgress", count: seen.size });
      }

      // ── Settle: confirm the true end, patiently waiting out slow pages ──
      let spinnerSeen = false;
      for (let s = 0; s < 22; s++) {
        const scroller = findScroller();
        scroller.scrollTop = scroller.scrollHeight;
        window.scrollTo(0, document.documentElement.scrollHeight);
        lastRow()?.scrollIntoView({ block: "end" });
        const loading = moreToLoad();
        if (loading) spinnerSeen = true;
        await sleep(loading ? 3000 : 1400);
        const before = seen.size;
        scrapeNow();
        post({ kind: "scrapeProgress", count: seen.size });
        if (seen.size > before) s = -1; // progress — keep settling
        else if (!moreToLoad()) break; // no sentinel, no progress → done
      }

      scrapeNow();
      const endedClean = !moreToLoad();
      const lastTitle = (lastRow()?.querySelector(".title")?.textContent || "").trim();
      post({
        kind: "scrapeDone",
        count: seen.size,
        domPeak,
        spinnerSeen,
        endedClean,
        lastTitle,
      });
    })();
  });
})();
