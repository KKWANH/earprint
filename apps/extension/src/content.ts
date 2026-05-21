/**
 * Content script (ISOLATED world) — runs on music.youtube.com.
 *
 * Responsibilities:
 *  1. Parse and accumulate browse responses passed via postMessage from inject.ts
 *  2. On the popup's PA_SYNC request: flush the buffer, then auto-scroll until
 *     the list is fully loaded (detected via the continuation token)
 *  3. Forward the accumulated tracks to background
 */
import type { CapturedTrack } from "@playlist-analyzer/shared";
import { extractTracks, hasContinuation } from "./parser";

const tracks = new Map<string, CapturedTrack>();
let reachedEnd = false;

window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as { __pa?: boolean; kind?: string; data?: unknown } | undefined;
  if (e.source !== window || !msg?.__pa || msg.kind !== "browse") return;
  const before = tracks.size;
  extractTracks(msg.data, tracks);
  // A response that delivered tracks but has no continuation token is the
  // last page — that is the reliable signal that everything is loaded.
  if (tracks.size > before && !hasContinuation(msg.data)) reachedEnd = true;
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
  reachedEnd = false;

  // Re-receive the responses buffered in inject before this script loaded.
  window.postMessage({ __pa: true, kind: "flush" }, "*");
  await sleep(400);

  // Auto-scroll until the continuation token says we hit the end.
  await autoScroll();

  const list = [...tracks.values()];
  if (list.length === 0) {
    return { ok: false, error: "수집된 곡이 없습니다 (페이지를 새로고침 후 다시 시도)" };
  }
  return chrome.runtime.sendMessage({ type: "PA_UPLOAD", tracks: list });
}

/**
 * Scrolls to the bottom repeatedly until the last page is received.
 * Stops on `reachedEnd` (continuation token exhausted). The long stable-window
 * fallback only triggers if the end is never detected — it must be patient
 * enough not to false-stop while a continuation is still loading.
 */
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
