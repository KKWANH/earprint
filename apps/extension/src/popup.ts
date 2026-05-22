/** Popup — connect via the web app's Google login, then sync. */

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const msgEl = document.getElementById("msg") as HTMLParagraphElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;

void chrome.storage.sync.get(["syncToken"]).then((s) => {
  statusEl.textContent = s.syncToken
    ? "✅ Connected — ready to sync"
    : '⚠ Not connected — click "Connect via web"';
});

connectBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: "https://earprint.kwanho.dev/connect" });
  msgEl.textContent =
    "Sign in with Google on the page that opens — it connects automatically. Then reopen this popup.";
});

syncBtn.addEventListener("click", async () => {
  msgEl.textContent = "Syncing… auto-scrolling the page to read your full list.";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.includes("music.youtube.com")) {
    msgEl.textContent =
      "Open the Liked Music (LM) page on music.youtube.com first.";
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
          msgEl.textContent = `Collecting… ${(p.count ?? 0).toLocaleString()} songs (scrolling)`;
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
        verdict = "✅ All songs collected";
      } else if (res.endedClean) {
        verdict = `⚠ Reached the end of the list, but YouTube only served ${cap} songs (a YouTube-side limit — last song: ${res.lastTitle || "?"})`;
      } else {
        verdict = `⚠ Loading stopped at ${cap} songs (still loading — please retry)`;
      }
      msgEl.textContent =
        `Done — total ${res.total ?? "?"} / collected ${cap}/${exp || "?"}` +
        `${res.domPeak ? ` · peak ${res.domPeak} rows` : ""}\n${verdict}`;
    } else {
      msgEl.textContent = `Failed: ${res?.error ?? `HTTP ${res?.status ?? "?"}`}`;
    }
  } catch (err) {
    finished = true;
    clearInterval(poll);
    msgEl.textContent = `Error: ${String(err)} — refresh the page and try again`;
  }
});
