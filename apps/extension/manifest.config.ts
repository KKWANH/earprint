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
 */
export default defineManifest({
  manifest_version: 3,
  name: "Playlist Analyzer — YT Music 수집기",
  version: "0.1.0",
  description: "유튜브 뮤직 좋아요 곡 목록을 수집해 Playlist Analyzer 로 보냅니다.",
  permissions: ["storage", "tabs"],
  // Including the workers.dev backend in host_permissions exempts the
  // extension's fetch from CORS, making uploads reliable.
  host_permissions: ["https://music.youtube.com/*", "https://*.workers.dev/*"],
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
  ],
  action: {
    default_title: "Playlist Analyzer",
    default_popup: "src/popup.html",
  },
});
