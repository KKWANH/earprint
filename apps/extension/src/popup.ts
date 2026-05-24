/**
 * Popup — three-step funnel (connect → sync → view). State is recomputed
 * each time the popup opens so the user always sees where they are.
 *
 * i18n via chrome.i18n.getMessage — locales live in public/_locales/<lang>/messages.json.
 * Browser UI language picks which one Chrome serves.
 */

/** Short alias — `chrome.i18n.getMessage` with optional substitutions. */
const t = (key: string, subs?: string[]) => chrome.i18n.getMessage(key, subs);

// Fill in every `data-i18n="key"` element at boot. Done before any state
// computation so the popup never flashes English defaults.
document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
  const key = el.dataset.i18n;
  if (key) el.textContent = t(key);
});

const stepConnect = document.getElementById("step-connect") as HTMLDivElement;
const stepSync = document.getElementById("step-sync") as HTMLDivElement;
const stepView = document.getElementById("step-view") as HTMLDivElement;
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;
const viewBtn = document.getElementById("view") as HTMLButtonElement;
const syncHint = document.getElementById("sync-hint") as HTMLDivElement;
const msgEl = document.getElementById("msg") as HTMLParagraphElement;
const guideLink = document.getElementById("guide-link") as HTMLAnchorElement;

const WEB_ORIGIN = "https://earprint.kwanho.dev";
guideLink.href = `${WEB_ORIGIN}/guide`;

type Step = "connect" | "sync" | "view";

function setStep(active: Step, doneBefore = true) {
  const order: Step[] = ["connect", "sync", "view"];
  const els: Record<Step, HTMLDivElement> = {
    connect: stepConnect,
    sync: stepSync,
    view: stepView,
  };
  const idx = order.indexOf(active);
  for (let i = 0; i < order.length; i++) {
    const el = els[order[i]!]!;
    el.classList.remove("active", "done");
    if (i === idx) el.classList.add("active");
    else if (i < idx && doneBefore) el.classList.add("done");
  }
}

function showMsg(text: string, kind: "info" | "error" | "success" = "info") {
  msgEl.textContent = text;
  msgEl.classList.remove("error", "success");
  if (kind === "error") msgEl.classList.add("error");
  if (kind === "success") msgEl.classList.add("success");
  msgEl.classList.add("show");
}

/** Initial render — figure out where the user is in the funnel. */
async function refresh() {
  const [stored, [tab]] = await Promise.all([
    chrome.storage.sync.get(["syncToken"]),
    chrome.tabs.query({ active: true, currentWindow: true }),
  ]);
  const onYtMusic = !!tab?.url?.includes("music.youtube.com");
  const connected = !!stored.syncToken;

  if (!connected) {
    setStep("connect", false);
    syncBtn.disabled = true;
    syncHint.textContent = t("step2HintNotConnected");
    return;
  }

  setStep("sync");
  syncBtn.disabled = false;
  syncHint.textContent = onYtMusic ? t("step2HintOnYt") : t("step2HintOffYt");
}

connectBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: `${WEB_ORIGIN}/connect` });
  showMsg(t("msgConnectOpened"));
});

syncBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Sync needs the popup to talk to a music.youtube.com tab. If the user
  // clicked sync from any other tab, send them to Liked Music — the content
  // script will be ready when they reopen the popup.
  if (!tab?.id || !tab.url?.includes("music.youtube.com")) {
    await chrome.tabs.create({
      url: "https://music.youtube.com/playlist?list=LM",
    });
    showMsg(t("msgYtOpened"));
    return;
  }
  const tabId = tab.id;
  syncBtn.disabled = true;
  showMsg(t("msgSyncing"));
  let finished = false;

  // Poll the content script for a live collected-count while it scrolls.
  const poll = setInterval(() => {
    void chrome.tabs
      .sendMessage(tabId, { type: "PA_PROGRESS" })
      .then((p: { count?: number } | undefined) => {
        if (!finished && p) {
          showMsg(
            t("msgCollecting", [(p.count ?? 0).toLocaleString()]),
          );
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
    syncBtn.disabled = false;
    if (res?.ok) {
      const cap = res.captured ?? 0;
      const exp = res.expected ?? 0;
      if (!exp || cap >= exp * 0.97) {
        showMsg(
          t("msgSyncSuccess", [cap.toLocaleString(), String(res.total ?? "?")]),
          "success",
        );
      } else if (res.endedClean) {
        showMsg(
          t("msgSyncPartial", [String(cap), String(exp), res.lastTitle ?? "?"]),
          "info",
        );
      } else {
        showMsg(
          t("msgSyncStopped", [String(cap), String(exp)]),
          "error",
        );
      }
      setStep("view");
    } else {
      showMsg(
        t("msgSyncFailed", [res?.error ?? `HTTP ${res?.status ?? "?"}`]),
        "error",
      );
    }
  } catch (err) {
    finished = true;
    clearInterval(poll);
    syncBtn.disabled = false;
    showMsg(t("msgError", [String(err)]), "error");
  }
});

viewBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: `${WEB_ORIGIN}/library` });
});

void refresh();
