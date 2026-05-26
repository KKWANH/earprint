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

// Web origin is baked at build-time via Vite so a fork / staging build
// only needs to flip one env: VITE_WEB_ORIGIN=https://staging.example.com pnpm run build
const WEB_ORIGIN: string =
  (import.meta as unknown as { env?: { VITE_WEB_ORIGIN?: string } }).env
    ?.VITE_WEB_ORIGIN ?? "https://earprint.kwanho.dev";
guideLink.href = `${WEB_ORIGIN}/guide`;

const openLmLink = document.getElementById("open-lm") as HTMLAnchorElement | null;
if (openLmLink) {
  openLmLink.href = "https://music.youtube.com/playlist?list=LM";
}

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

/** Renders the sync result regardless of where it came from (sendMessage
 *  response or chrome.storage.local poll). Centralised so both code paths
 *  show identical UX. */
function renderSyncResult(res: {
  ok?: boolean;
  error?: string;
  status?: number;
  total?: number;
  captured?: number;
  expected?: number | null;
  endedClean?: boolean;
  lastTitle?: string;
}) {
  syncBtn.disabled = false;
  if (res.ok) {
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
      t("msgSyncFailed", [res.error ?? `HTTP ${res.status ?? "?"}`]),
      "error",
    );
  }
}

syncBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

  // Clear any stale status from a prior run so we don't immediately resolve
  // on whatever was last in storage.
  await chrome.storage.local.remove("paSyncStatus");

  // Trigger the sync. We DO NOT await sendMessage — it can reject mid-run
  // if YouTube Music's SPA navigates and unloads the content script, but
  // the actual work + final result lives in chrome.storage.local now.
  void chrome.tabs.sendMessage(tabId, { type: "PA_SYNC" }).catch(() => {
    /* channel may close — storage poll below is the source of truth */
  });

  // Watch chrome.storage.local for completion. We use both onChanged (fast
  // path) and a polling interval (fallback in case onChanged misses an
  // update across tab restarts).
  let done = false;
  const finish = (res: Record<string, unknown>) => {
    if (done) return;
    done = true;
    chrome.storage.onChanged.removeListener(onChange);
    clearInterval(poll);
    renderSyncResult(res as Parameters<typeof renderSyncResult>[0]);
  };

  function onChange(changes: { [k: string]: chrome.storage.StorageChange }) {
    const s = changes.paSyncStatus?.newValue as
      | {
          state?: string;
          captured?: number;
          result?: Record<string, unknown>;
          error?: string;
        }
      | undefined;
    if (!s) return;
    if (s.state === "running") {
      showMsg(t("msgCollecting", [(s.captured ?? 0).toLocaleString()]));
    } else if (s.state === "uploading") {
      showMsg(t("msgSyncing"));
    } else if (s.state === "done") {
      finish(s.result ?? {});
    } else if (s.state === "failed") {
      finish({ ok: false, error: s.error });
    }
  }
  chrome.storage.onChanged.addListener(onChange);

  // Fallback poll every 2s in case onChanged fires before our listener is
  // attached, or in case the popup re-opens mid-sync.
  const poll = setInterval(async () => {
    const { paSyncStatus } = await chrome.storage.local.get("paSyncStatus");
    onChange({ paSyncStatus: { newValue: paSyncStatus, oldValue: undefined } });
  }, 2000);

  // Hard ceiling — abandon UI updates after ~10 min if nothing ever finishes.
  setTimeout(() => {
    if (!done) {
      done = true;
      chrome.storage.onChanged.removeListener(onChange);
      clearInterval(poll);
      syncBtn.disabled = false;
      showMsg(t("msgError", ["sync timed out"]), "error");
    }
  }, 600000);
});

viewBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: `${WEB_ORIGIN}/library` });
});

void refresh();
