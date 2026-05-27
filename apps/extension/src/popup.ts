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
const connectBtn = document.getElementById("connect") as HTMLButtonElement;
const syncBtn = document.getElementById("sync") as HTMLButtonElement;
const stopBtn = document.getElementById("stop-sync") as HTMLButtonElement;
const syncHint = document.getElementById("sync-hint") as HTMLDivElement;
const msgEl = document.getElementById("msg") as HTMLParagraphElement;
const guideLink = document.getElementById("guide-link") as HTMLAnchorElement;
const dashboardLink = document.getElementById("dashboard-link") as HTMLAnchorElement;

// Web origin is baked at build-time via Vite so a fork / staging build
// only needs to flip one env: VITE_WEB_ORIGIN=https://staging.example.com pnpm run build
const WEB_ORIGIN: string =
  (import.meta as unknown as { env?: { VITE_WEB_ORIGIN?: string } }).env
    ?.VITE_WEB_ORIGIN ?? "https://earprint.kwanho.dev";
guideLink.href = `${WEB_ORIGIN}/guide`;
dashboardLink.href = `${WEB_ORIGIN}/library`;

const openLmLink = document.getElementById("open-lm") as HTMLAnchorElement | null;
if (openLmLink) {
  openLmLink.href = "https://music.youtube.com/playlist?list=LM";
}

// Two-step funnel only: connect → sync. The dashboard isn't a funnel goal —
// after sync the user usually wants to be able to re-sync (their likes
// change), so we stay on step 2. Dashboard access is a sidelink instead.
type Step = "connect" | "sync";

function setStep(active: Step, doneBefore = true) {
  const order: Step[] = ["connect", "sync"];
  const els: Record<Step, HTMLDivElement> = {
    connect: stepConnect,
    sync: stepSync,
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

/** Initial render — figure out where the user is in the funnel.
 *  Also cleans up stale `running` state from a previous popup session
 *  that crashed mid-sync (otherwise the popup re-opens stuck on
 *  "Collecting…" with no way out). */
async function refresh() {
  // Stale-state cleanup: if storage says we're still "running" but the
  // startedAt is >10 min ago, treat it as abandoned and clear.
  try {
    const { paSyncStatus } = (await chrome.storage.local.get(
      "paSyncStatus",
    )) as { paSyncStatus?: { state?: string; startedAt?: number } };
    if (
      paSyncStatus?.state === "running" &&
      typeof paSyncStatus.startedAt === "number" &&
      Date.now() - paSyncStatus.startedAt > 10 * 60_000
    ) {
      await chrome.storage.local.remove("paSyncStatus");
    }
  } catch {
    /* non-fatal */
  }

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
  // Wipe the stored token before opening /connect so the next pairing is
  // always a clean read — avoids stale-token confusion when the user
  // re-creates their account or rotates the token from /account.
  void chrome.storage.sync.remove("syncToken");
  void chrome.tabs.create({ url: `${WEB_ORIGIN}/connect` });
  showMsg(t("msgConnectOpened"));
});

/** Renders the sync result regardless of where it came from (sendMessage
 *  response or chrome.storage.local poll). Centralised so both code paths
 *  show identical UX.
 *
 *  Sync is append-only server-side now — there's no complete / partial
 *  distinction to surface. Every successful upload adds new captures and
 *  refreshes existing positions; nothing is ever removed. The message
 *  just reports how many landed and (if relevant) how many were sliced
 *  off by the free-tier cap before save.
 */
function renderSyncResult(res: {
  ok?: boolean;
  error?: string;
  status?: number;
  total?: number;
  captured?: number;
  expected?: number | null;
  new_likes?: number;
  new_tracks?: number;
  plan_dropped?: number;
  plan_cap?: number;
}) {
  syncBtn.disabled = false;
  hideStopButton();
  if (res.ok) {
    const cap = res.captured ?? 0;
    const newLikes = res.new_likes ?? 0;
    const expected = res.expected ?? null;

    // "Sent 1,417 songs (12 new this run)" — communicates both that
    // the data landed and how much of it was new since last sync.
    // append-only is the only mode now, so no warning about partial vs
    // complete needed.
    const headerHint =
      expected != null && cap < expected
        ? ` · header showed ${expected.toLocaleString()}`
        : "";
    let msg = `✓ Sent ${cap.toLocaleString()} songs${headerHint}`;
    if (newLikes > 0) msg += ` · ${newLikes.toLocaleString()} new`;
    if (res.plan_dropped && res.plan_dropped > 0) {
      msg += `\n📦 Free-tier cap: ${res.plan_dropped.toLocaleString()} extra tracks were dropped before save (limit ${(res.plan_cap ?? 0).toLocaleString()}).`;
    }
    showMsg(msg, "success");
    return;
  }

  // 401: backend rejected the stored sync_token. Wipe it locally so the
  // popup drops back to step 1 (Connect) — without this the user is
  // stuck on the Sync button with no obvious way to re-pair.
  const looks401 =
    res.status === 401 || (res.error && /401/.test(res.error));
  if (looks401) {
    void chrome.storage.sync.remove("syncToken").then(() => {
      setStep("connect", false);
      syncBtn.disabled = true;
      syncHint.textContent = t("step2HintNotConnected");
    });
    showMsg(t("msgSyncFailed", [res.error ?? "401"]), "error");
    return;
  }

  showMsg(
    t("msgSyncFailed", [res.error ?? `HTTP ${res.status ?? "?"}`]),
    "error",
  );
}

/** Stop-button visibility helpers. The button is hidden in the HTML by
 *  default; we surface it only while a scrape is actively running. */
function showStopButton() {
  stopBtn.hidden = false;
  stopBtn.disabled = false;
}
function hideStopButton() {
  stopBtn.hidden = true;
}

// Manual stop — fires a one-way "PA_STOP_SYNC" to the active tab. The
// content script intercepts the message, marks its inject scrape's exit
// flag, and uploads whatever's been captured so far with
// diagnostics.manualStop=true. The popup keeps watching paSyncStatus
// for the "done" / "failed" transition like any other end-of-scrape.
stopBtn.addEventListener("click", async () => {
  stopBtn.disabled = true;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  void chrome.tabs
    .sendMessage(tab.id, { type: "PA_STOP_SYNC" })
    .catch(() => {
      /* channel may have died — content script will still see the
       * paSyncStatus tick and bail at the next opportunity. */
    });
  showMsg(t("msgStopRequested"));
});

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
  showStopButton();
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
  // update across tab restarts). A 1s ticker also re-renders the "updated
  // Ns ago" line so the user sees freshness drift even when no storage
  // change has fired in a while — that's exactly what surfaces a stall.
  let done = false;
  let lastStatus:
    | {
        state?: string;
        phase?: string;
        captured?: number;
        updatedAt?: number;
        result?: Record<string, unknown>;
        error?: string;
      }
    | null = null;
  const ticker = setInterval(() => {
    if (!lastStatus || done) return;
    if (lastStatus.state === "running") onChange({ paSyncStatus: { newValue: lastStatus, oldValue: undefined } as chrome.storage.StorageChange });
  }, 1000);
  const finish = (res: Record<string, unknown>) => {
    if (done) return;
    done = true;
    chrome.storage.onChanged.removeListener(onChange);
    clearInterval(poll);
    clearInterval(ticker);
    renderSyncResult(res as Parameters<typeof renderSyncResult>[0]);
  };

  function onChange(changes: { [k: string]: chrome.storage.StorageChange }) {
    const s = changes.paSyncStatus?.newValue as
      | {
          state?: string;
          phase?: string;
          captured?: number;
          updatedAt?: number;
          result?: Record<string, unknown>;
          error?: string;
        }
      | undefined;
    if (!s) return;
    lastStatus = s;
    if (s.state === "running") {
      // Translate phase + freshness into a single line so the user can
      // tell "still working" from "wedged" without thinking.
      const cap = (s.captured ?? 0).toLocaleString();
      const phaseLabel =
        s.phase === "uploading"
          ? "Uploading"
          : s.phase === "settling"
            ? "Settling"
            : "Scrolling";
      const ageMs = s.updatedAt ? Date.now() - s.updatedAt : 0;
      const ageLabel =
        ageMs < 3_000
          ? "live"
          : ageMs < 60_000
            ? `${Math.round(ageMs / 1000)}s ago`
            : `${Math.round(ageMs / 60_000)}m ago`;
      const stalled = ageMs > 20_000;
      const msg =
        `${phaseLabel} · ${cap} songs · updated ${ageLabel}` +
        (stalled ? "\n⚠ No update in 20s — try Reset if it doesn't recover." : "");
      showMsg(msg, stalled ? "error" : "info");
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
      clearInterval(ticker);
      syncBtn.disabled = false;
      hideStopButton();
      showMsg(t("msgError", ["sync timed out"]), "error");
    }
  }, 600000);
});

/** Nuclear reset — clears every bit of extension-local state so the next
 *  pairing is guaranteed to be a clean read. Useful when the user has
 *  re-created their account, rotated tokens externally, or the popup
 *  has somehow ended up in an inconsistent state we can't reason about. */
const resetLink = document.getElementById("reset-link") as HTMLAnchorElement | null;
resetLink?.addEventListener("click", async (e) => {
  e.preventDefault();
  await Promise.all([
    chrome.storage.sync.remove("syncToken").catch(() => {}),
    chrome.storage.local.remove("paSyncStatus").catch(() => {}),
  ]);
  showMsg(
    "Extension state cleared. Click the Open earprint.kwanho.dev button above to re-pair.",
    "info",
  );
  await refresh();
});

void refresh();
