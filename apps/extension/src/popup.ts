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
  void chrome.tabs.create({ url: "https://earprint.kwanho.dev/connect" });
  msgEl.textContent =
    "열린 페이지에서 Google 로그인하면 자동으로 연결됩니다. 그다음 이 팝업을 다시 열어주세요.";
});

syncBtn.addEventListener("click", async () => {
  msgEl.textContent = "동기화 중… 페이지를 자동 스크롤하며 전체 곡을 읽는 중입니다.";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("music.youtube.com")) {
    msgEl.textContent = "music.youtube.com 의 좋아요(LM) 페이지를 연 상태로 실행하세요";
    return;
  }
  const tabId = tab.id;
  let finished = false;

  // Poll the content script for a live collected-count while it scrolls.
  const poll = setInterval(() => {
    chrome.tabs
      .sendMessage(tabId, { type: "PA_PROGRESS" })
      .then((p: { count?: number } | undefined) => {
        if (!finished && p) {
          msgEl.textContent = `수집 중… ${(p.count ?? 0).toLocaleString()}곡 (스크롤 진행 중)`;
        }
      })
      .catch(() => {});
  }, 1000);

  try {
    const res = (await chrome.tabs.sendMessage(tabId, { type: "PA_SYNC" })) as
      | {
          ok: boolean;
          error?: string;
          status?: number;
          new_tracks?: number;
          new_likes?: number;
          total?: number;
          captured?: number;
          expected?: number | null;
          domPeak?: number;
          spinnerSeen?: boolean;
          endedClean?: boolean;
          lastTitle?: string;
        }
      | undefined;
    finished = true;
    clearInterval(poll);
    if (res?.ok) {
      const cap = res.captured ?? 0;
      const exp = res.expected ?? 0;
      let verdict = "";
      if (!exp || cap >= exp * 0.97) {
        verdict = "✅ 전곡 수집 완료";
      } else if (res.endedClean) {
        verdict = `⚠ 목록 끝까지 도달했지만 유튜브가 ${cap}곡만 내려줌 (유튜브 측 한계 — 마지막 곡: ${res.lastTitle || "?"})`;
      } else {
        verdict = `⚠ ${cap}곡에서 로딩이 멈춤 (로딩 표시 잔존 — 재시도 필요)`;
      }
      msgEl.textContent =
        `완료 — 총 ${res.total ?? "?"} / 수집 ${cap}/${exp || "?"}곡` +
        `${res.domPeak ? ` · 화면최대 ${res.domPeak}행` : ""}\n${verdict}`;
    } else {
      msgEl.textContent = `실패: ${res?.error ?? `HTTP ${res?.status ?? "?"}`}`;
    }
  } catch (err) {
    finished = true;
    clearInterval(poll);
    msgEl.textContent = `오류: ${String(err)} — 페이지를 새로고침 후 다시 시도하세요`;
  }
});
