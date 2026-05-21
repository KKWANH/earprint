/**
 * Content script (ISOLATED world) — runs on music.youtube.com.
 *
 *  1. Accumulates browse responses passed via postMessage from inject.ts.
 *  2. On the popup's PA_SYNC request: runs inject's deterministic "harvest"
 *     (replays InnerTube continuations). Falls back to scroll-based loading
 *     if the harvest can't run.
 *  3. Forwards the accumulated tracks to background.
 */
import type { CapturedTrack } from "@playlist-analyzer/shared";
import { extractTracks, hasContinuation } from "./parser";

const tracks = new Map<string, CapturedTrack>();
let reachedEnd = false;
let onHarvestDone: ((ok: boolean) => void) | null = null;

window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as
    | { __pa?: boolean; kind?: string; data?: unknown; ok?: boolean }
    | undefined;
  if (e.source !== window || !msg?.__pa) return;

  if (msg.kind === "browse") {
    const before = tracks.size;
    extractTracks(msg.data, tracks);
    if (tracks.size > before && !hasContinuation(msg.data)) reachedEnd = true;
  } else if (msg.kind === "harvestDone") {
    onHarvestDone?.(msg.ok === true);
    onHarvestDone = null;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if ((message as { type?: string })?.type === "PA_SYNC") {
    runSync()
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }
  return false;
});

async function runSync(): Promise<unknown> {
  if (!location.href.includes("list=LM")) {
    return { ok: false, error: "좋아요(LM) 플레이리스트 페이지에서 실행하세요" };
  }
  tracks.clear();
  reachedEnd = false;

  // Primary: deterministic continuation replay (fast + complete).
  const harvested = await new Promise<boolean>((resolve) => {
    onHarvestDone = resolve;
    window.postMessage({ __pa: true, kind: "harvest" }, "*");
    setTimeout(() => {
      if (onHarvestDone) {
        onHarvestDone = null;
        resolve(false);
      }
    }, 120000);
  });

  // Fallback: scroll-based loading if the harvest couldn't run.
  if (!harvested) {
    window.postMessage({ __pa: true, kind: "flush" }, "*");
    await sleep(400);
    await autoScroll();
  }

  const list = [...tracks.values()];
  if (list.length === 0) {
    return { ok: false, error: "수집된 곡이 없습니다 (페이지를 새로고침 후 다시 시도)" };
  }
  return chrome.runtime.sendMessage({ type: "PA_UPLOAD", tracks: list });
}

/** Fallback — scroll to the bottom until the continuation token is exhausted. */
async function autoScroll(): Promise<void> {
  let lastCount = -1;
  let stable = 0;
  for (let i = 0; i < 600 && !reachedEnd && stable < 30; i++) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    document
      .querySelector("ytmusic-responsive-list-item-renderer:last-of-type")
      ?.scrollIntoView(false);
    await sleep(600);
    if (tracks.size === lastCount) {
      stable++;
    } else {
      stable = 0;
      lastCount = tracks.size;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.info("[Playlist Analyzer] content script ready");
