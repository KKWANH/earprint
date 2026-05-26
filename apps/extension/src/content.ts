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
let lastProgress = 0;
const diag: {
  domPeak: number;
  spinnerSeen: boolean;
  endedClean: boolean;
  lastTitle: string;
} = { domPeak: 0, spinnerSeen: false, endedClean: false, lastTitle: "" };

window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as
    | {
        __pa?: boolean;
        kind?: string;
        data?: unknown;
        track?: CapturedTrack;
        count?: number;
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
  } else if (msg.kind === "scrapeDone") {
    diag.domPeak = msg.domPeak ?? 0;
    diag.spinnerSeen = msg.spinnerSeen ?? false;
    diag.endedClean = msg.endedClean ?? false;
    diag.lastTitle = msg.lastTitle ?? "";
    onScrapeDone?.();
    onScrapeDone = null;
  }
});

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
  if (type === "PA_PROGRESS") {
    sendResponse({ count: tracks.size });
    return false;
  }
  return false;
});

/** Single source of truth for sync state. Popup polls / watches this key
 *  rather than awaiting a long-lived sendMessage that the SPA can kill. */
type SyncStatus =
  | { state: "running"; startedAt: number; captured: number; expected: number | null }
  | { state: "uploading"; captured: number; expected: number | null }
  | { state: "done"; result: Record<string, unknown> }
  | { state: "failed"; error: string };

async function writeStatus(s: SyncStatus): Promise<void> {
  try {
    await chrome.storage.local.set({ paSyncStatus: s });
  } catch {
    /* storage hiccup is non-fatal */
  }
}

async function runSync(): Promise<unknown> {
  if (!location.href.includes("list=LM")) {
    const r = { ok: false, error: "Run this on the Liked Music (LM) playlist page" };
    await writeStatus({ state: "failed", error: r.error });
    return r;
  }
  tracks.clear();
  lastProgress = 0;
  diag.domPeak = 0;
  diag.spinnerSeen = false;
  diag.endedClean = false;
  diag.lastTitle = "";
  await writeStatus({
    state: "running",
    startedAt: Date.now(),
    captured: 0,
    expected: expectedCount(),
  });

  // Periodic status refresh — popup can re-open mid-sync and pick up
  // current progress without needing a live message channel.
  const statusTimer = setInterval(() => {
    void writeStatus({
      state: "running",
      startedAt: Date.now(),
      captured: tracks.size,
      expected: expectedCount(),
    });
  }, 1500);

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

    const list = [...tracks.values()];
    if (list.length === 0) {
      const r = { ok: false, error: "No songs collected — refresh the page and try again" };
      await writeStatus({ state: "failed", error: r.error });
      return r;
    }

    await writeStatus({
      state: "uploading",
      captured: list.length,
      expected: expectedCount(),
    });
    const expected = expectedCount();
    // Upload directly from the content script. Previously this hopped
    // through the background service worker, but MV3 SWs get suspended
    // after ~30s of inactivity — the await on sendMessage would hang
    // silently and the popup stayed at "Collecting…" forever. Content
    // scripts have the same host_permissions and live as long as the
    // tab, so the fetch reliably completes.
    const result = await uploadDirect(list);
    const full: Record<string, unknown> = {
      ...result,
      captured: list.length,
      expected,
      domPeak: diag.domPeak,
      spinnerSeen: diag.spinnerSeen,
      endedClean: diag.endedClean,
      lastTitle: diag.lastTitle,
    };
    await writeStatus({ state: "done", result: full });
    return full;
  } catch (err) {
    // Any uncaught path must leave a `failed` state behind so the popup
    // doesn't spin on "running" forever.
    const error = err instanceof Error ? err.message : String(err);
    await writeStatus({ state: "failed", error });
    return { ok: false, error };
  } finally {
    clearInterval(statusTimer);
  }
}

/** Backend host is baked at build-time — mirrors background.ts. */
const BACKEND: string =
  (import.meta as unknown as { env?: { VITE_WEB_ORIGIN?: string } }).env
    ?.VITE_WEB_ORIGIN ?? "https://earprint.kwanho.dev";

/** Direct backend upload from the content script. Replaces the previous
 *  background-SW hop that was prone to MV3 service-worker suspension. */
async function uploadDirect(
  list: CapturedTrack[],
): Promise<Record<string, unknown>> {
  const { syncToken } = await chrome.storage.sync.get(["syncToken"]);
  if (!syncToken) {
    return {
      ok: false,
      error: 'Extension not connected — click "Connect" in the popup',
    };
  }
  const body = { source: "ytmusic", tracks: list };
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
    return { ok: false, error: `Network error: ${String(err)}` };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
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
