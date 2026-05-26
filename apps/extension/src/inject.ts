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

      // ── Scroll loop, redesigned to terminate on time-based criteria ──
      //
      // The previous iteration-based stall counter (30 iterations of no
      // growth) could stay stuck forever when YT served fresh-but-dup
      // rows: seen.size never grew enough to flip the stall flag, and
      // the loop just kept scrolling. The new termination is purely
      // wall-clock based and inspects the actual scroll position + the
      // loading sentinel, which gives a deterministic upper bound.
      //
      //   STALL_MS               12s — no new items at all = stalled.
      //   STALL_BAILOUT_MS       45s — even if still 'loading', give up.
      //   MAX_TOTAL_MS           5 min — hard ceiling for the whole scroll.
      //   ATBOTTOM_FUZZ          50px — counts as 'at the bottom of the list'.
      //
      // Done when: at the very bottom of the scroller AND no spinner /
      // continuation sentinel AND no new items for STALL_MS.
      // Bailout when: total time exceeds MAX_TOTAL_MS, or stalled for
      // STALL_BAILOUT_MS regardless of scroll position.
      const STALL_MS = 12_000;
      const STALL_BAILOUT_MS = 45_000;
      const MAX_TOTAL_MS = 300_000;
      const ATBOTTOM_FUZZ = 50;

      findScroller().scrollTop = 0;
      window.scrollTo(0, 0);
      await sleep(900);
      scrapeNow();

      const startedAt = Date.now();
      let lastGrowAt = Date.now();
      let lastSize = 0;
      let spinnerSeen = false;

      while (Date.now() - startedAt < MAX_TOTAL_MS) {
        scrapeNow();
        const scroller = findScroller();
        const stepPx = Math.max(360, scroller.clientHeight * 0.7);
        scroller.scrollTop += stepPx;
        window.scrollBy(0, stepPx);

        // After each scroll, give the virtualised list time to render —
        // longer when a loading spinner is visible (YT is fetching) so we
        // don't accidentally count its working time against the stall.
        const loadingDuringStep = moreToLoad();
        if (loadingDuringStep) spinnerSeen = true;
        await sleep(loadingDuringStep ? 700 : 280);
        scrapeNow();

        if (seen.size > lastSize) {
          lastSize = seen.size;
          lastGrowAt = Date.now();
        }
        post({ kind: "scrapeProgress", count: seen.size });

        const stalledMs = Date.now() - lastGrowAt;
        const scroller2 = findScroller();
        const atBottom =
          scroller2.scrollTop + scroller2.clientHeight >=
          scroller2.scrollHeight - ATBOTTOM_FUZZ;
        const loading = moreToLoad();

        // Nudge the last row into view when we've stalled — sometimes
        // unsticks YT's virtualisation.
        if (stalledMs > STALL_MS / 2) {
          lastRow()?.scrollIntoView({ block: "end" });
        }

        // Done: bottom reached, no loading indicator, no new items for STALL_MS.
        if (atBottom && !loading && stalledMs > STALL_MS) break;
        // Bailout: stalled too long even though we're still 'loading' —
        // YT throttled us or quietly stopped serving rows. Trust what
        // we have and move on.
        if (stalledMs > STALL_BAILOUT_MS) break;
      }

      post({ kind: "scrapePhase", phase: "settling" });

      // ── Settle pass — short and time-capped this time. Just gives YT one
      // last chance to render anything that was about to come in. ──
      const SETTLE_MAX_MS = 20_000;
      const settleStart = Date.now();
      while (Date.now() - settleStart < SETTLE_MAX_MS) {
        const scroller = findScroller();
        scroller.scrollTop = scroller.scrollHeight;
        window.scrollTo(0, document.documentElement.scrollHeight);
        lastRow()?.scrollIntoView({ block: "end" });
        const loading = moreToLoad();
        if (loading) spinnerSeen = true;
        await sleep(loading ? 2000 : 1000);
        const before = seen.size;
        scrapeNow();
        post({ kind: "scrapeProgress", count: seen.size });
        if (seen.size === before && !moreToLoad()) break;
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
