import { defineManifest } from "@crxjs/vite-plugin";

/**
 * Chrome extension manifest (MV3).
 * The extension is intentionally thin — it only collects the liked-songs list
 * from music.youtube.com and sends it to the backend. It runs solely within
 * the user's own session.
 *
 * Collection strategy:
 *  - inject.ts (MAIN world, document_start): patches the page's fetch to
 *    intercept youtubei/v1/browse responses.
 *  - content.ts (ISOLATED world): parses and accumulates intercepted responses,
 *    auto-scrolls to load the full list, then hands it to background.
 *
 * Localisation: strings live in public/_locales/<lang>/messages.json and
 * resolve via Chrome's __MSG_<key>__ syntax (manifest) and
 * chrome.i18n.getMessage (runtime).
 */
export default defineManifest({
  manifest_version: 3,
  name: "__MSG_appName__",
  default_locale: "en",
  version: "0.9.5",
  description: "__MSG_appDescription__",
  icons: {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png",
  },
  permissions: ["storage", "tabs"],
  // Including the backend host exempts the extension's fetch from CORS.
  host_permissions: ["https://music.youtube.com/*", "https://*.kwanho.dev/*"],
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["https://music.youtube.com/*"],
      js: ["src/inject.ts"],
      run_at: "document_start",
      world: "MAIN",
    },
    {
      matches: ["https://music.youtube.com/*"],
      js: ["src/content.ts"],
      run_at: "document_idle",
    },
    {
      // Captures the sync token from the web app's /connect page.
      matches: ["https://earprint.kwanho.dev/*"],
      js: ["src/connect.ts"],
      run_at: "document_idle",
    },
  ],
  action: {
    default_title: "__MSG_popupTitle__",
    default_popup: "src/popup.html",
    default_icon: {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  },
});
