/** Popup — saves settings and triggers sync. */

const urlInput = document.getElementById("url") as HTMLInputElement;
const tokenInput = document.getElementById("token") as HTMLInputElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

const DEFAULT_BACKEND = "https://music.kwanho.dev";

void chrome.storage.sync.get(["backendUrl", "syncToken"]).then((s) => {
  let url = (s.backendUrl as string) ?? "";
  // Self-heal: the old *.workers.dev URL is no longer served.
  if (!url || url.includes("workers.dev")) {
    url = DEFAULT_BACKEND;
    void chrome.storage.sync.set({ backendUrl: url });
  }
  urlInput.value = url;
  tokenInput.value = (s.syncToken as string) ?? "";
});

/** Fixes a missing https:// and trailing slashes. */
function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

saveBtn.addEventListener("click", () => {
  const backendUrl = normalizeUrl(urlInput.value);
  urlInput.value = backendUrl; // reflect the normalized value in the UI
  void chrome.storage.sync
    .set({ backendUrl, syncToken: tokenInput.value.trim() })
    .then(() => setStatus("설정을 저장했습니다"));
});

syncBtn.addEventListener("click", async () => {
  setStatus("동기화 중… (자동 스크롤로 전체 곡을 불러옵니다)");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("music.youtube.com")) {
    setStatus("music.youtube.com 의 좋아요(LM) 페이지를 연 상태로 실행하세요");
    return;
  }
  try {
    const res = (await chrome.tabs.sendMessage(tab.id, { type: "PA_SYNC" })) as
      | { ok: boolean; error?: string; status?: number; new_tracks?: number; new_likes?: number; total?: number }
      | undefined;
    if (res?.ok) {
      setStatus(
        `완료 — 신규 트랙 ${res.new_tracks ?? "?"} · 신규 좋아요 ${res.new_likes ?? "?"} / 총 ${res.total ?? "?"}`,
      );
    } else {
      setStatus(`실패: ${res?.error ?? `HTTP ${res?.status ?? "?"}`}`);
    }
  } catch (err) {
    setStatus(`오류: ${String(err)} — 페이지를 새로고침 후 다시 시도하세요`);
  }
});
