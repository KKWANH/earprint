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

  // Manual-stop flag, flipped by a {kind: "stop"} message from content.ts
  // when the user clicks Stop in the popup. The scroll loop checks this
  // on every iteration and bails out of every remaining pass; the settle
  // loop also short-circuits. We deliberately don't tear the scrape
  // down hard — letting the loop exit naturally means scrapeNow() fires
  // once more and `endedClean` reads false (truthful: the user
  // interrupted, the scrape didn't reach the bottom on its own).
  let stopRequested = false;

  window.addEventListener("message", (e: MessageEvent) => {
    const stopMsg = e.data as { __pa?: boolean; kind?: string } | undefined;
    if (e.source === window && stopMsg?.__pa && stopMsg.kind === "stop") {
      stopRequested = true;
    }
  });

  window.addEventListener("message", (e: MessageEvent) => {
    const d = e.data as { __pa?: boolean; kind?: string } | undefined;
    if (e.source !== window || !d?.__pa || d.kind !== "scrape") return;

    void (async () => {
      // Reset per-run. Otherwise a second scrape in the same page life
      // would inherit a stale stop from the previous one.
      stopRequested = false;
      const seen = new Set<string>();
      let domPeak = 0;

      // Recency order is captured implicitly by the *order in which we
      // first see a videoId*: DOM querySelectorAll returns rows top-to-
      // bottom, and YT serves the LM playlist newest-first. The Map
      // downstream (content.ts) preserves insertion order on first set(),
      // so the upload array indices line up with the user's like order.
      // The backend then assigns list_position from array index in
      // sync_liked_tracks (WITH ORDINALITY) — no extension-side bookkeeping.
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

      /** Remove rows that have scrolled well past the top of the viewport.
       *  YT Music's virtualisation is conservative — for ~1,500-row
       *  libraries it keeps the lot in the DOM after scrolling, which is
       *  what eventually OOMs the renderer. We've already captured the
       *  row's data into `seen`, so dropping the DOM node is safe (the
       *  continuation pagination uses an internal token, not DOM state).
       *  Keeps a buffer above the visible viewport so YT's own scroll
       *  recyclers don't fight us. */
      const REMOVE_BUFFER_PX = 2000; // ~30 rows of headroom above viewport
      const cleanupOffscreen = () => {
        const rows = document.querySelectorAll("ytmusic-responsive-list-item-renderer");
        const scroller = findScroller();
        const scrollTop = scroller.scrollTop;
        let removed = 0;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i] as HTMLElement;
          // offsetTop is relative to nearest positioned ancestor — for YT
          // Music's playlist that's effectively the scroller. Close enough
          // for the "is this row well above the viewport?" check.
          if (row.offsetTop + row.offsetHeight < scrollTop - REMOVE_BUFFER_PX) {
            row.remove();
            removed++;
          } else {
            // Rows below threshold; the rest are even closer to viewport.
            break;
          }
        }
        return removed;
      };

      // YouTube's "load more" sentinel. While this element exists the list
      // still has more pages; when it is gone the list has truly ended.
      const moreToLoad = () =>
        document.querySelector("ytmusic-continuation-item-renderer") != null ||
        document.querySelector(
          "tp-yt-paper-spinner[active], tp-yt-paper-spinner-lite[active]",
        ) != null;

      // ── Multi-pass scroll, redesigned around the failure modes we hit:
      //
      // 1. **YT silently stops paginating** around 1,400-1,500 rows on big
      //    libraries. The 'still loading' sentinel may stay forever even
      //    though no new rows ever come in. We need a hard wall-clock cap.
      //
      // 2. **Renderer OOM**: the virtualised list keeps too much DOM at
      //    once on big libraries and Chrome kills the tab ("Aw, snap!").
      //    Doing a top-of-list ⇄ bottom-of-list cycle lets YT recycle
      //    off-screen nodes between passes, releasing memory.
      //
      // 3. **scrapeNow() on every step iterates the entire row list (O(N))**
      //    — fine at 100 rows, painful at 1,500. Throttle DOM scraping to
      //    once every ~1s. The fetch-intercept side (window.fetch hook
      //    above) keeps capturing browse responses regardless.
      //
      // Up to 3 passes; bails early if a full pass adds zero rows.
      const PASSES = 3;
      const PASS_STALL_MS = 8_000;    // no new rows for 8s ends a pass
      const PASS_BAILOUT_MS = 35_000; // hard cap per pass
      const ATBOTTOM_FUZZ = 60;
      const SCRAPE_THROTTLE_MS = 900; // run scrapeNow at most once per second

      let lastScrapeAt = 0;
      let lastCleanupAt = 0;
      // DOM cleanup runs less often than scrape — every ~3s. More frequent
      // cleanup risks fighting YT's own recycling logic; less frequent
      // lets the DOM pile up again. 3s with 2000px buffer = ~30 rows of
      // headroom which YT comfortably manages.
      const CLEANUP_THROTTLE_MS = 3000;
      const maybeScrape = () => {
        const now = Date.now();
        if (now - lastScrapeAt < SCRAPE_THROTTLE_MS) return;
        lastScrapeAt = now;
        scrapeNow();
        if (now - lastCleanupAt > CLEANUP_THROTTLE_MS) {
          lastCleanupAt = now;
          const removed = cleanupOffscreen();
          if (removed > 0) post({ kind: "scrapeCleanup", removed });
        }
      };

      let spinnerSeen = false;
      let totalLastSize = 0;

      for (let pass = 0; pass < PASSES; pass++) {
        if (stopRequested) break;
        post({ kind: "scrapePhase", phase: "scrolling" });
        post({ kind: "scrapePass", pass: pass + 1, total: PASSES });

        // Reset to top — this prompts YT to release the rows it had
        // virtualised at the bottom, fixing the memory pressure that
        // crashed the renderer mid-scroll on big libraries.
        findScroller().scrollTop = 0;
        window.scrollTo(0, 0);
        await sleep(pass === 0 ? 900 : 1500);
        maybeScrape();

        const passStart = Date.now();
        let passLastGrow = Date.now();
        let passLastSize = seen.size;

        while (Date.now() - passStart < PASS_BAILOUT_MS) {
          if (stopRequested) break;
          maybeScrape();
          const scroller = findScroller();
          const stepPx = Math.max(360, scroller.clientHeight * 0.7);
          scroller.scrollTop += stepPx;
          window.scrollBy(0, stepPx);

          const loading = moreToLoad();
          if (loading) spinnerSeen = true;
          await sleep(loading ? 700 : 280);
          maybeScrape();

          if (seen.size > passLastSize) {
            passLastSize = seen.size;
            passLastGrow = Date.now();
          }
          post({ kind: "scrapeProgress", count: seen.size });

          const stalledMs = Date.now() - passLastGrow;
          const sc = findScroller();
          const atBottom =
            sc.scrollTop + sc.clientHeight >= sc.scrollHeight - ATBOTTOM_FUZZ;
          const stillLoading = moreToLoad();

          if (stalledMs > PASS_STALL_MS / 2) {
            lastRow()?.scrollIntoView({ block: "end" });
          }
          // End pass when at bottom + nothing loading + stalled for the
          // grace window. Always exit on PASS_BAILOUT_MS via the while.
          if (atBottom && !stillLoading && stalledMs > PASS_STALL_MS) break;
        }

        // Run one synchronous scrape at the bottom so anything still
        // rendered gets captured before we reset for the next pass.
        scrapeNow();

        // No new rows during this entire pass → further passes won't help.
        if (seen.size === totalLastSize) break;
        totalLastSize = seen.size;
      }

      post({ kind: "scrapePhase", phase: "settling" });

      // ── Settle pass — short and time-capped. Just gives YT one last
      // chance to render anything that was about to come in. ──
      const SETTLE_MAX_MS = 15_000;
      const settleStart = Date.now();
      while (Date.now() - settleStart < SETTLE_MAX_MS) {
        if (stopRequested) break;
        const scroller = findScroller();
        scroller.scrollTop = scroller.scrollHeight;
        window.scrollTo(0, document.documentElement.scrollHeight);
        lastRow()?.scrollIntoView({ block: "end" });
        const loading = moreToLoad();
        if (loading) spinnerSeen = true;
        await sleep(loading ? 1800 : 900);
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
