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

  // Verify pass — fired by content.ts AFTER the main scrape ends (whether
  // naturally or via manual Stop). Walks the list top→bottom one more
  // time, FAST, reading every renderer that's currently in the DOM. The
  // purpose is two-fold:
  //   1. catch rows the main pass missed because of timing (DOM updates
  //      slower than our adaptive cadence on some libraries),
  //   2. give the user a second number to compare against — both
  //      collected count AND verified count are surfaced in the result UI.
  // Verify is intentionally NOT supposed to trigger new pagination; it
  // only reads what's already on the page from the main pass.
  window.addEventListener("message", (e: MessageEvent) => {
    const m = e.data as { __pa?: boolean; kind?: string } | undefined;
    if (e.source !== window || !m?.__pa || m.kind !== "verify") return;

    void (async () => {
      const verifiedIds = new Set<string>();

      const readDom = () => {
        const rows = Array.from(
          document.querySelectorAll("ytmusic-responsive-list-item-renderer"),
        );
        for (const row of rows) {
          const data = rendererOf(row);
          const id = data ? pickVideoId(data) : (fromDomText(row)?.videoId ?? null);
          if (id) verifiedIds.add(id);
        }
      };

      // Snap to top — 400 ms is enough to let YT recycle, since the list
      // is already fully loaded by the main pass (we're not waiting for
      // pagination here, just reading the DOM).
      const sc = findScroller();
      sc.scrollTop = 0;
      window.scrollTo(0, 0);
      await sleep(400);
      readDom();

      // Walk down FAST in near-viewport steps. 10 s hard ceiling covers
      // any realistic library at this cadence. Break the moment we
      // hit bottom AND nothing new came in this iteration — verify
      // reads are deterministic so one zero-growth at bottom is
      // conclusive (the old two-strike check was paranoia overhead).
      const VERIFY_MAX_MS = 10_000;
      const t0 = Date.now();
      while (Date.now() - t0 < VERIFY_MAX_MS) {
        if (stopRequested) break;
        const before = verifiedIds.size;
        const step = Math.max(280, sc.clientHeight * 0.95);
        sc.scrollTop += step;
        window.scrollBy(0, step);
        await sleep(130);
        readDom();
        const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 30;
        if (atBottom && verifiedIds.size === before) break;
      }

      post({ kind: "verifyDone", verifiedCount: verifiedIds.size });
    })();
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

      // (Previously had a cleanupOffscreen() that pruned scrolled-past
      //  DOM nodes to fight renderer OOM on big libraries. Removed in
      //  the May 2026 scrape stabilisation pass — it was racing with
      //  the scrape phase that hadn't read those rows yet, causing
      //  captured tracks to silently drop out of `seen`. YT's own
      //  recycler handles big lists fine; the between-pass scroll-to-
      //  top reset below covers the OOM concern.)

      // YouTube's "load more" sentinel. While this element exists the list
      // still has more pages; when it is gone the list has truly ended.
      const moreToLoad = () =>
        document.querySelector("ytmusic-continuation-item-renderer") != null ||
        document.querySelector(
          "tp-yt-paper-spinner[active], tp-yt-paper-spinner-lite[active]",
        ) != null;

      // ── Multi-pass scroll, redesigned around three real failure modes
      //    testers reported (May 2026 revision):
      //
      // 1. **Spinner stacking**: the previous loop's fixed 700 ms wait
      //    while `moreToLoad()` was true could end before the in-flight
      //    pagination actually resolved. The next scroll step then
      //    triggered ANOTHER pagination request on top of the unresolved
      //    one — testers reported "8 loading bars stacked on the page".
      //    Fix: `waitForSpinner()` actively polls until the sentinel
      //    clears (or a per-iter ceiling fires), THEN scrolls.
      //
      // 2. **Vanishing rows**: cleanupOffscreen() removed rows from the
      //    DOM that were already above the viewport, but YT's virtualiser
      //    sometimes hadn't fully populated `.data` on them yet, and our
      //    scrape racing with the remove caused captured tracks to drop
      //    out of `seen`. We removed the mid-pass cleanup entirely — the
      //    between-pass scroll-to-top reset already gives YT enough room
      //    to recycle on its own.
      //
      // 3. **Mechanical cadence**: fixed stepPx + fixed sleep made the
      //    page feel jerky and gave YT no chance to settle. Now the step
      //    size shrinks when nothing new came in last iter (back-off) and
      //    grows back when rows are flowing (forward-momentum). Sleep
      //    base is also longer per-iter (320 ms → 500 ms) so the page
      //    has time to breathe.
      //
      // YT silently stops paginating around 1,400-1,500 rows on big
      // libraries (the 'still loading' sentinel may stay forever even
      // though no new rows ever come in), so we still need the hard
      // wall-clock cap.
      const PASSES = 3;
      const PASS_STALL_MS = 8_000;    // no new rows for 8s ends a pass
      const PASS_BAILOUT_MS = 45_000; // hard cap per pass (bumped — slower cadence)
      const ATBOTTOM_FUZZ = 60;
      const SCRAPE_THROTTLE_MS = 900; // run scrapeNow at most once per second
      const SPINNER_MAX_WAIT_MS = 3_000;  // wait at most this long for spinner clear
      const SPINNER_POLL_MS = 120;        // how often to re-check spinner

      let lastScrapeAt = 0;
      // Throttle scrape only — DOM cleanup removed (was causing the
      // "music disappearing" reports). YT's own virtualiser recycles
      // off-screen rows fine on its own; the worst-case OOM is
      // mitigated by the between-pass scroll-to-top reset below.
      const maybeScrape = () => {
        const now = Date.now();
        if (now - lastScrapeAt < SCRAPE_THROTTLE_MS) return;
        lastScrapeAt = now;
        scrapeNow();
      };

      // Wait for the loading sentinel to clear OR for the ceiling to hit.
      // Used between every scroll step so we never trigger pagination
      // while a previous request is still in flight.
      const waitForSpinner = async (): Promise<void> => {
        const deadline = Date.now() + SPINNER_MAX_WAIT_MS;
        while (Date.now() < deadline) {
          if (!moreToLoad()) return;
          await sleep(SPINNER_POLL_MS);
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
        await sleep(pass === 0 ? 1200 : 1800);
        maybeScrape();

        const passStart = Date.now();
        let passLastGrow = Date.now();
        let passLastSize = seen.size;
        // Adaptive scroll step factor: starts at 0.45 of viewport, decays
        // to 0.25 when nothing new comes in, grows back to 0.55 when
        // rows are flowing. Total range stays "gentler than before" so
        // YT's virtualiser keeps up.
        let stepFactor = 0.45;

        while (Date.now() - passStart < PASS_BAILOUT_MS) {
          if (stopRequested) break;

          // FIRST: drain any still-pending pagination. If we scroll
          // while the spinner is still up YT happily queues another
          // request on top of it — that's the "8 loading bars" symptom.
          if (moreToLoad()) {
            spinnerSeen = true;
            await waitForSpinner();
          }
          maybeScrape();

          // Scroll a moderate step, NOT a viewport-jump. The smaller
          // step is what keeps YT's virtualiser from dropping rows we
          // haven't had a chance to read yet.
          const scroller = findScroller();
          const stepPx = Math.max(280, scroller.clientHeight * stepFactor);
          scroller.scrollTop += stepPx;
          window.scrollBy(0, stepPx);

          // Settle window after the scroll. Slightly longer than the
          // old 280 ms minimum so the page can render the rows that
          // just got requested by THIS scroll, before our next iter
          // reads them.
          await sleep(500);
          maybeScrape();

          // Adaptive step: did this scroll bring in anything new?
          const grew = seen.size > passLastSize;
          if (grew) {
            passLastSize = seen.size;
            passLastGrow = Date.now();
            // Rows are flowing — keep the cadence comfortable. Don't
            // accelerate past 0.55 because aggressive jumps reintroduce
            // the spinner-stacking failure mode.
            stepFactor = Math.min(0.55, stepFactor + 0.05);
          } else {
            // Nothing came in — back off so YT has more time per step
            // to render. Bottoms out at 0.25 = ~25% of viewport.
            stepFactor = Math.max(0.25, stepFactor - 0.05);
          }
          post({ kind: "scrapeProgress", count: seen.size });

          const stalledMs = Date.now() - passLastGrow;
          const sc = findScroller();
          const atBottom =
            sc.scrollTop + sc.clientHeight >= sc.scrollHeight - ATBOTTOM_FUZZ;
          const stillLoading = moreToLoad();

          // Half-stall nudge: scroll the last visible row into view to
          // trigger another pagination request directly from YT's
          // IntersectionObserver.
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
      // chance to render anything that was about to come in. Same
      // spinner-drain discipline as the main loop so we don't queue
      // pagination on top of pagination here either.
      //
      // Cap shortened May 2026 (18 s → 7 s) after testers reported the
      // tail end of sync felt "stuck". By this point the main scrape
      // has already drained the list 3× over; settle's only job is to
      // catch the last in-flight pagination, not to keep pulling new
      // rows. If first iteration sees no new growth and no spinner,
      // bail immediately — there's nothing left to settle. ──
      const SETTLE_MAX_MS = 7_000;
      const settleStart = Date.now();
      let firstSettleIter = true;
      while (Date.now() - settleStart < SETTLE_MAX_MS) {
        if (stopRequested) break;
        // Fast bail on first iter: nothing pending + nothing on screen
        // means there's nothing for settle to do.
        if (firstSettleIter && !moreToLoad()) {
          const sizeBefore = seen.size;
          scrapeNow();
          if (seen.size === sizeBefore) break;
        }
        firstSettleIter = false;
        // Drain pending pagination FIRST so the bottom-jump below
        // doesn't pile a fresh request on top of it.
        if (moreToLoad()) {
          spinnerSeen = true;
          await waitForSpinner();
        }
        const scroller = findScroller();
        scroller.scrollTop = scroller.scrollHeight;
        window.scrollTo(0, document.documentElement.scrollHeight);
        lastRow()?.scrollIntoView({ block: "end" });
        // Sleep tightened 1100 → 600 ms — YT renders the new row
        // batch fast enough that a longer wait just sits idle.
        await sleep(600);
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
