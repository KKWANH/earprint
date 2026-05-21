/**
 * Service worker — sends the likes collected by the content script to the backend.
 *
 * The sync token is saved to chrome.storage.sync from the popup; the backend
 * URL defaults to the live host. /api/sync authenticates via a Bearer token.
 */
import type { CapturedTrack, SyncRequest } from "@playlist-analyzer/shared";

const DEFAULT_BACKEND = "https://music.kwanho.dev";

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

/** Resolves the backend URL — defaults to the live host, ignores the stale workers.dev URL. */
function resolveBackendUrl(raw: unknown): string {
  let url = String(raw ?? "").trim();
  if (!url || url.includes("workers.dev")) return DEFAULT_BACKEND;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

async function upload(tracks: CapturedTrack[]): Promise<unknown> {
  const { backendUrl, syncToken } = await chrome.storage.sync.get([
    "backendUrl",
    "syncToken",
  ]);
  if (!syncToken) {
    return { ok: false, error: "팝업에서 동기화 토큰을 먼저 설정하세요" };
  }

  const endpoint = `${resolveBackendUrl(backendUrl)}/api/sync`;
  console.info(`[Playlist Analyzer] upload → ${endpoint} (tracks=${tracks.length})`);

  const body: SyncRequest = { source: "ytmusic", tracks };
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(syncToken)}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("[Playlist Analyzer] network error", err);
    return { ok: false, error: `백엔드 연결 실패 — ${endpoint} (${String(err)})` };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) console.error(`[Playlist Analyzer] HTTP ${res.status}`, data);
  return { ok: res.ok, status: res.status, ...data };
}
