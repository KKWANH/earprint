/**
 * Content script on music.kwanho.dev — captures the sync token from the
 * /connect page so the user never has to copy-paste it. The page renders a
 * hidden #pa-sync-token element once the user is signed in with Google.
 */
const el = document.getElementById("pa-sync-token");
const token = el?.getAttribute("data-token");

if (token) {
  void chrome.storage.sync.set({ syncToken: token }).then(() => {
    const toast = document.createElement("div");
    toast.textContent = "✓ Playlist Analyzer 확장에 연결되었습니다";
    toast.style.cssText =
      "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);" +
      "background:#059669;color:#fff;padding:10px 16px;border-radius:8px;" +
      "font:14px system-ui;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,.4)";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  });
}

export {};
