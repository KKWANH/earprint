/**
 * Content script (ISOLATED world) — runs on music.youtube.com.
 *
 * Responsibilities:
 *  1. Parse and accumulate browse responses passed via postMessage from inject.ts
 *  2. On the popup's PA_SYNC request: flush the buffer, then auto-scroll to load everything
 *  3. Forward the accumulated tracks to background
 */
import type { CapturedTrack } from "@playlist-analyzer/shared";
import { extractTracks } from "./parser";

const tracks = new Map<string, CapturedTrack>();

window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data as { __pa?: boolean; kind?: string; data?: unknown } | undefined;
  if (e.source !== window || !msg?.__pa || msg.kind !== "browse") return;
  extractTracks(msg.data, tracks);
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
  // 1) Re-receive the initial responses buffered in inject
  window.postMessage({ __pa: true, kind: "flush" }, "*");
  await sleep(400);

  // 2) Auto-scroll so all tracks get loaded
  await autoScroll();

  // 3) Upload the accumulated tracks to background
  const list = [...tracks.values()];
  if (list.length === 0) {
    return { ok: false, error: "수집된 곡이 없습니다 (페이지를 새로고침 후 다시 시도)" };
  }
  return chrome.runtime.sendMessage({ type: "PA_UPLOAD", tracks: list });
}

/** Scroll to the bottom of the page until no more new tracks appear. */
async function autoScroll(): Promise<void> {
  let lastCount = -1;
  let stableRounds = 0;
  for (let i = 0; i < 300 && stableRounds < 5; i++) {
    window.scrollTo(0, document.documentElement.scrollHeight);
    document
      .querySelector("ytmusic-responsive-list-item-renderer:last-of-type")
      ?.scrollIntoView(false);
    await sleep(700);
    if (tracks.size === lastCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      lastCount = tracks.size;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

console.info("[Playlist Analyzer] content script ready");
