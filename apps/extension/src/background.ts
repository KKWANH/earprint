/**
 * Service worker — sends the likes collected by the content script to the backend.
 * The sync token is captured automatically by the connect.ts content script;
 * the backend host is fixed.
 */
import type { CapturedTrack, SyncRequest } from "@playlist-analyzer/shared";

// Backend host is baked at build-time via Vite — flip VITE_WEB_ORIGIN for
// dev / staging builds without touching the source.
const BACKEND: string =
  (import.meta as unknown as { env?: { VITE_WEB_ORIGIN?: string } }).env
    ?.VITE_WEB_ORIGIN ?? "https://earprint.kwanho.dev";

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
      error: 'Extension not connected — click "Connect via web" in the popup',
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
    return { ok: false, error: `Backend connection failed (${String(err)})` };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) console.error(`[Playlist Analyzer] HTTP ${res.status}`, data);
  return { ok: res.ok, status: res.status, ...data };
}
