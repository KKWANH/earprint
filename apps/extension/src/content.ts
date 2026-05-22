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
    runSync()
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }
  if (type === "PA_PROGRESS") {
    // Live count for the popup while a sync is running.
    sendResponse({ count: tracks.size });
    return false;
  }
  return false;
});

async function runSync(): Promise<unknown> {
  if (!location.href.includes("list=LM")) {
    return { ok: false, error: "Run this on the Liked Music (LM) playlist page" };
  }
  tracks.clear();
  lastProgress = 0;
  diag.domPeak = 0;
  diag.spinnerSeen = false;
  diag.endedClean = false;
  diag.lastTitle = "";

  // inject.ts scrolls the real UI and reads every rendered row.
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
    return { ok: false, error: "No songs collected — refresh the page and try again" };
  }

  const expected = expectedCount();
  const result = (await chrome.runtime.sendMessage({
    type: "PA_UPLOAD",
    tracks: list,
  })) as Record<string, unknown> | undefined;
  return {
    ...(result ?? {}),
    captured: list.length,
    expected,
    domPeak: diag.domPeak,
    spinnerSeen: diag.spinnerSeen,
    endedClean: diag.endedClean,
    lastTitle: diag.lastTitle,
  };
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
