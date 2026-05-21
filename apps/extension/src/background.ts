/**
 * Service worker — sends the likes collected by the content script to the backend.
 * The sync token is captured automatically by the connect.ts content script;
 * the backend host is fixed.
 */
import type { CapturedTrack, SyncRequest } from "@playlist-analyzer/shared";

const BACKEND = "https://music.kwanho.dev";

interface UploadMessage {
  type: "PA_UPLOAD";
  tracks: CapturedTrack[];
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if ((message as { type?: string })?.type === "PA_UPLOAD") {
    upload((message as UploadMessage).tracks)
      .then(sendResponse)
      .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
    return true; // async response
  }
  return false;
});

async function upload(tracks: CapturedTrack[]): Promise<unknown> {
  const { syncToken } = await chrome.storage.sync.get(["syncToken"]);
  if (!syncToken) {
    return {
      ok: false,
      error: "확장이 연결되지 않았습니다 — 팝업에서 '웹에서 연결'을 누르세요",
    };
  }

  const body: SyncRequest = { source: "ytmusic", tracks };
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(syncToken)}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[Playlist Analyzer] network error", err);
    return { ok: false, error: `백엔드 연결 실패 (${String(err)})` };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) console.error(`[Playlist Analyzer] HTTP ${res.status}`, data);
  return { ok: res.ok, status: res.status, ...data };
}
