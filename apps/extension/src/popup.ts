/** Popup — connect via the web app's Google login, then sync. */

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const msgEl = document.getElementById("msg") as HTMLParagraphElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;

void chrome.storage.sync.get(["syncToken"]).then((s) => {
  statusEl.textContent = s.syncToken
    ? "✅ 연결됨 — 동기화할 수 있어요"
    : "⚠ 연결이 필요합니다 — '웹에서 연결'을 누르세요";
});

connectBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: "https://music.kwanho.dev/connect" });
  msgEl.textContent =
    "열린 페이지에서 Google 로그인하면 자동으로 연결됩니다. 그다음 이 팝업을 다시 열어주세요.";
});

syncBtn.addEventListener("click", async () => {
  msgEl.textContent = "동기화 중… (자동 스크롤로 전체 곡을 불러옵니다)";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("music.youtube.com")) {
    msgEl.textContent = "music.youtube.com 의 좋아요(LM) 페이지를 연 상태로 실행하세요";
    return;
  }
  try {
    const res = (await chrome.tabs.sendMessage(tab.id, { type: "PA_SYNC" })) as
      | {
          ok: boolean;
          error?: string;
          status?: number;
          new_tracks?: number;
          new_likes?: number;
          total?: number;
        }
      | undefined;
    if (res?.ok) {
      msgEl.textContent = `완료 — 신규 트랙 ${res.new_tracks ?? "?"} · 신규 좋아요 ${res.new_likes ?? "?"} / 총 ${res.total ?? "?"}`;
    } else {
      msgEl.textContent = `실패: ${res?.error ?? `HTTP ${res?.status ?? "?"}`}`;
    }
  } catch (err) {
    msgEl.textContent = `오류: ${String(err)} — 페이지를 새로고침 후 다시 시도하세요`;
  }
});
