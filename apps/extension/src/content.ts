/**
 * Content script (ISOLATED world) — runs on music.youtube.com.
 *
 *  1. Tells inject.ts (MAIN world) to scrape: it scrolls the real UI and
 *     reads every rendered row.
 *  2. Accumulates the rows + any intercepted browse responses into a map.
 *  3. Forwards the collected tracks to the background service worker.
 */
import type { CapturedTrack } from "@playlist-analyzer/shared";
import { extractTracks } from "./parser";

const tracks = new Map<string, CapturedTrack>();
let onScrapeDone: (() => void) | null = null;
let onVerifyDone: ((count: number) => void) | null = null;
let lastProgress = 0;
const diag: {
  domPeak: number;
  spinnerSeen: boolean;
  endedClean: boolean;
  lastTitle: string;
  verifiedCount: number | null;
} = { domPeak: 0, spinnerSeen: false, endedClean: false, lastTitle: "", verifiedCount: null };

window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as
    | {
        __pa?: boolean;
        kind?: string;
        data?: unknown;
        track?: CapturedTrack;
        count?: number;
        verifiedCount?: number;
        domPeak?: number;
        spinnerSeen?: boolean;
        endedClean?: boolean;
        lastTitle?: string;
      }
    | undefined;
  if (e.source !== window || !msg?.__pa) return;

  if (msg.kind === "browse") {
    extractTracks(msg.data, tracks);
  } else if (msg.kind === "domTrack" && msg.track) {
    const t = msg.track;
    if (t.videoId && t.title) tracks.set(t.videoId, t);
  } else if (msg.kind === "scrapeProgress") {
    lastProgress = msg.count ?? 0;
  } else if (
    msg.kind === "scrapePhase" &&
    typeof (msg as { phase?: unknown }).phase === "string"
  ) {
    const p = (msg as { phase: string }).phase;
    if (p === "scrolling" || p === "settling" || p === "uploading" || p === "verifying") {
      currentPhase = p;
    }
  } else if (msg.kind === "scrapeDone") {
    diag.domPeak = msg.domPeak ?? 0;
    diag.spinnerSeen = msg.spinnerSeen ?? false;
    diag.endedClean = msg.endedClean ?? false;
    diag.lastTitle = msg.lastTitle ?? "";
    onScrapeDone?.();
    onScrapeDone = null;
  } else if (msg.kind === "verifyDone") {
    const v = typeof msg.verifiedCount === "number" ? msg.verifiedCount : 0;
    diag.verifiedCount = v;
    onVerifyDone?.(v);
    onVerifyDone = null;
  }
});

// "User clicked Stop in the popup mid-scrape." Toggled true on the
// PA_STOP_SYNC message; runSync checks it after the scrape resolves to
// stamp diagnostics.manualStop. The actual scroll-loop interrupt is in
// inject.ts — we postMessage stop so the MAIN-world loop can see it.
let manuallyStopped = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = (message as { type?: string })?.type;
  if (type === "PA_SYNC") {
    // Fire-and-forget. The real result lives in chrome.storage.local under
    // `paSyncStatus` — the popup watches that key instead of awaiting our
    // sendResponse, which would die the moment YouTube Music's SPA
    // navigates or the popup closes. We still return the final result
    // through sendResponse for backwards-compat when the channel happens
    // to survive.
    runSync()
      .then((r) => sendResponse(r))
      .catch((err: unknown) =>
        sendResponse({ ok: false, error: String(err) }),
      );
    return true;
  }
  if (type === "PA_STOP_SYNC") {
    manuallyStopped = true;
    // Signal inject.ts's MAIN-world scrape loop to bail early. The
    // scroll loop polls its own stop flag at each iteration; once set,
    // it skips remaining passes and posts scrapeDone with the
    // captured-so-far list.
    window.postMessage({ __pa: true, kind: "stop" }, "*");
    sendResponse({ ok: true });
    return false;
  }
  if (type === "PA_PROGRESS") {
    sendResponse({ count: tracks.size });
    return false;
  }
  return false;
});

/** Single source of truth for sync state. Popup polls / watches this key
 *  rather than awaiting a long-lived sendMessage that the SPA can kill.
 *
 *  Each writeStatus call stamps `updatedAt` — the popup compares it to
 *  Date.now() so it can show "Updated 3s ago" and warn the user when no
 *  update has arrived for a long time (likely stall). */
type SyncPhase = "scrolling" | "settling" | "verifying" | "uploading";

type SyncStatus =
  | {
      state: "running";
      phase: SyncPhase;
      startedAt: number;
      updatedAt: number;
      captured: number;
      expected: number | null;
      verified?: number | null;
    }
  | { state: "done"; updatedAt: number; result: Record<string, unknown> }
  | { state: "failed"; updatedAt: number; error: string };

async function writeStatus(s: SyncStatus): Promise<void> {
  try {
    await chrome.storage.local.set({ paSyncStatus: s });
  } catch {
    /* storage hiccup is non-fatal */
  }
}

/** Mutable shared state between runSync() and the periodic statusTimer. */
let currentPhase: SyncPhase = "scrolling";
let runStartedAt = 0;

async function runSync(): Promise<unknown> {
  if (!location.href.includes("list=LM")) {
    const r = { ok: false, error: "Run this on the Liked Music (LM) playlist page" };
    await writeStatus({ state: "failed", updatedAt: Date.now(), error: r.error });
    return r;
  }
  tracks.clear();
  lastProgress = 0;
  diag.domPeak = 0;
  diag.spinnerSeen = false;
  diag.endedClean = false;
  diag.lastTitle = "";
  diag.verifiedCount = null;
  manuallyStopped = false;

  runStartedAt = Date.now();
  currentPhase = "scrolling";
  await writeStatus({
    state: "running",
    phase: currentPhase,
    startedAt: runStartedAt,
    updatedAt: Date.now(),
    captured: 0,
    expected: expectedCount(),
  });

  // Periodic heartbeat — fresh updatedAt every 1500ms so the popup can
  // tell "actively progressing" from "stuck since 30s ago" at a glance.
  const statusTimer = setInterval(() => {
    void writeStatus({
      state: "running",
      phase: currentPhase,
      startedAt: runStartedAt,
      updatedAt: Date.now(),
      captured: tracks.size,
      expected: expectedCount(),
    });
  }, 1500);

  // Incremental upload — every ~PARTIAL_THRESHOLD new captures, fire an
  // append-only upload of the current snapshot. This rescues the user
  // when the YT Music renderer dies mid-scroll (Aw Snap on 5k-track
  // libraries): every 250 captured songs are already on the server,
  // so a tab crash at 1,200/5,000 leaves them with 1,000+ tracks saved
  // instead of zero. Server gates the destructive delete on `complete`
  // and these all carry complete=false → strictly additive, no risk.
  //
  // Tradeoff: every periodic call also costs 1 against the per-token
  // daily sync cap. A 5k library does ~20 partials + 1 final = 21
  // calls; cap is 500/day (lifted from 200 specifically to accommodate
  // this flow), so a user can re-sync ~20 times/day before hitting it.
  const PARTIAL_THRESHOLD = 250;
  let lastUploadedSize = 0;
  let partialUploading = false;
  const partialTimer = setInterval(() => {
    if (partialUploading) return;
    if (tracks.size - lastUploadedSize < PARTIAL_THRESHOLD) return;
    const snapshot = [...tracks.values()];
    const sizeAtUpload = snapshot.length;
    partialUploading = true;
    void uploadDirect(snapshot, { partial: true })
      .then((res) => {
        // Only advance the watermark on confirmed-OK uploads. If the
        // periodic call fails (network blip, 429 rate limit), the next
        // tick will retry the same chunk plus any new growth.
        const ok =
          res && typeof res === "object" && (res as { ok?: unknown }).ok === true;
        if (ok) lastUploadedSize = sizeAtUpload;
      })
      .catch(() => {
        /* partials are best-effort — the final upload at scrape end
         * always sends the complete set with complete=actuallyComplete. */
      })
      .finally(() => {
        partialUploading = false;
      });
  }, 5000);

  try {
    await new Promise<void>((resolve) => {
      onScrapeDone = resolve;
      window.postMessage({ __pa: true, kind: "scrape" }, "*");
      // Generous ceiling — a large list with stalls can take several minutes.
      setTimeout(() => {
        if (onScrapeDone) {
          onScrapeDone = null;
          resolve();
        }
      }, 420000);
    });

    // Let any in-flight intercepted responses settle.
    await sleep(600);

    // Verification pass — top→bottom walk one more time, fast, to catch
    // rows the main pass missed and to give the user a second count to
    // compare against. Even on manualStop we still verify, so the user
    // gets a definitive number rather than wondering "did I stop too
    // early?". Time-capped inside inject.ts at 25s so a wedge doesn't
    // extend the run.
    currentPhase = "verifying";
    await writeStatus({
      state: "running",
      phase: "verifying",
      startedAt: runStartedAt,
      updatedAt: Date.now(),
      captured: tracks.size,
      expected: expectedCount(),
    });
    diag.verifiedCount = null;
    await new Promise<void>((resolve) => {
      onVerifyDone = (n) => {
        diag.verifiedCount = n;
        resolve();
      };
      window.postMessage({ __pa: true, kind: "verify" }, "*");
      // Hard ceiling on the wait too — inject's own cap is 10 s, ours
      // is 12 s as a safety net if the verifyDone message never makes
      // the round-trip. Tightened from 30 s after testers reported the
      // end of sync dragging.
      setTimeout(() => {
        if (onVerifyDone) {
          onVerifyDone = null;
          resolve();
        }
      }, 12_000);
    });

    const list = [...tracks.values()];
    if (list.length === 0) {
      const r = { ok: false, error: "No songs collected — refresh the page and try again" };
      await writeStatus({ state: "failed", updatedAt: Date.now(), error: r.error });
      return r;
    }

    currentPhase = "uploading";
    await writeStatus({
      state: "running",
      phase: "uploading",
      startedAt: runStartedAt,
      updatedAt: Date.now(),
      captured: list.length,
      expected: expectedCount(),
      verified: diag.verifiedCount,
    });
    const expected = expectedCount();
    const result = await uploadDirect(list, { manualStop: manuallyStopped });
    const full: Record<string, unknown> = {
      ...result,
      captured: list.length,
      expected,
      verified: diag.verifiedCount,
      domPeak: diag.domPeak,
      spinnerSeen: diag.spinnerSeen,
      endedClean: diag.endedClean,
      lastTitle: diag.lastTitle,
      manualStop: manuallyStopped,
    };
    await writeStatus({ state: "done", updatedAt: Date.now(), result: full });
    return full;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await writeStatus({ state: "failed", updatedAt: Date.now(), error });
    return { ok: false, error };
  } finally {
    clearInterval(statusTimer);
    clearInterval(partialTimer);
  }
}

/** Backend host is baked at build-time — mirrors background.ts. */
const BACKEND: string =
  (import.meta as unknown as { env?: { VITE_WEB_ORIGIN?: string } }).env
    ?.VITE_WEB_ORIGIN ?? "https://earprint.kwanho.dev";

/** Direct backend upload from the content script. Replaces the previous
 *  background-SW hop that was prone to MV3 service-worker suspension.
 *  Server is append-only now (see db/schema.sql), so there's no
 *  "complete" flag to compute — every upload is strictly additive,
 *  whether it's a mid-scrape partial or the end-of-scrape final. */
async function uploadDirect(
  list: CapturedTrack[],
  opts: { partial?: boolean; manualStop?: boolean } = {},
): Promise<Record<string, unknown>> {
  const { syncToken } = await chrome.storage.sync.get(["syncToken"]);
  if (!syncToken) {
    return {
      ok: false,
      error: 'Extension not connected — click "Connect" in the popup',
    };
  }
  const expected = expectedCount();
  const captured = list.length;
  const body = {
    source: "ytmusic" as const,
    tracks: list,
    diagnostics: {
      expected,
      captured,
      // `endedClean` reflects what the scroller saw, not what kind of
      // upload this is. Partial periodic uploads always report false
      // because by definition the scrape isn't done yet.
      endedClean: !opts.partial && diag.endedClean,
      domPeak: diag.domPeak,
      spinnerSeen: diag.spinnerSeen,
      lastTitle: diag.lastTitle || null,
      manualStop: opts.manualStop === true,
    },
  };
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(syncToken)}`,
      },
      body: JSON.stringify(body),
      // 90-second cap so a hung backend surfaces as an error rather than
      // an indefinite "uploading" state.
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    // Sanitised — String(err) on some browsers includes request details
    // (some polyfills leak the full Request including Authorization
    // header into the error message). The user only needs to know "the
    // network call didn't make it"; never include the raw error.
    const code =
      err instanceof Error && err.name === "TimeoutError" ? "timeout" : "network";
    return { ok: false, error: `Network error (${code})` };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // 401 specifically means the stored sync_token isn't in the users table
  // any more — typically because the user deleted/recreated their account
  // or rotated the token from /account. Hand back a message the popup can
  // turn into a direct call-to-action.
  if (res.status === 401) {
    return {
      ok: false,
      status: 401,
      error:
        "Sync token rejected (401). Click Connect in the popup to re-pair the extension.",
    };
  }
  return { ok: res.ok, status: res.status, ...data };
}

/** Reads the liked-songs total from the playlist header ("2,353곡 • …"). */
function expectedCount(): number | null {
  const text = document.body?.innerText ?? "";
  let best: number | null = null;
  for (const m of text.matchAll(/([\d,]{2,})\s*(?:곡|songs?|tracks?)/gi)) {
    if (!m[1]) continue;
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    if (Number.isFinite(n) && (best === null || n > best)) best = n;
  }
  return best;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.info("[Playlist Analyzer] content script ready");
