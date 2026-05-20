/**
 * Content script (ISOLATED world) — music.youtube.com 에서 실행.
 *
 * 역할:
 *  1. inject.ts 가 postMessage 로 넘긴 browse 응답을 파싱·누적
 *  2. 팝업의 PA_SYNC 요청 시: 버퍼 flush → 자동 스크롤로 전체 로드
 *  3. 누적된 트랙을 background 로 전달
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
    return true; // 비동기 응답
  }
  return false;
});

async function runSync(): Promise<unknown> {
  if (!location.href.includes("list=LM")) {
    return { ok: false, error: "좋아요(LM) 플레이리스트 페이지에서 실행하세요" };
  }
  // 1) inject 버퍼에 쌓인 초기 응답을 다시 받는다
  window.postMessage({ __pa: true, kind: "flush" }, "*");
  await sleep(400);

  // 2) 전체 곡이 로드되도록 자동 스크롤
  await autoScroll();

  // 3) 누적분을 background 로 업로드
  const list = [...tracks.values()];
  if (list.length === 0) {
    return { ok: false, error: "수집된 곡이 없습니다 (페이지를 새로고침 후 다시 시도)" };
  }
  return chrome.runtime.sendMessage({ type: "PA_UPLOAD", tracks: list });
}

/** 새 곡이 더 안 나올 때까지 페이지 하단으로 스크롤. */
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
