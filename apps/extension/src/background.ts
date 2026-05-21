/**
 * Service worker — sends the likes collected by the content script to the backend.
 *
 * The backend URL and sync token are saved to chrome.storage.sync from the popup.
 * /api/sync authenticates via a Bearer token and allows CORS.
 */
import type { CapturedTrack, SyncRequest } from "@playlist-analyzer/shared";

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

/** Fixes a missing scheme (no https://) and trailing slashes. */
function normalizeBackendUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

async function upload(tracks: CapturedTrack[]): Promise<unknown> {
  const { backendUrl, syncToken } = await chrome.storage.sync.get([
    "backendUrl",
    "syncToken",
  ]);
  if (!backendUrl || !syncToken) {
    return { ok: false, error: "팝업에서 백엔드 URL 과 동기화 토큰을 먼저 설정하세요" };
  }

  const endpoint = `${normalizeBackendUrl(String(backendUrl))}/api/sync`;
  console.info(`[Playlist Analyzer] 업로드 → ${endpoint} (tracks=${tracks.length})`);

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
    console.error("[Playlist Analyzer] 네트워크 오류", err);
    return {
      ok: false,
      error: `백엔드 연결 실패 — URL 확인 필요: ${endpoint} (${String(err)})`,
    };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) console.error(`[Playlist Analyzer] HTTP ${res.status}`, data);
  return { ok: res.ok, status: res.status, ...data };
}
