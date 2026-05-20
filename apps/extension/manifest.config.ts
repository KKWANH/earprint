import { defineManifest } from "@crxjs/vite-plugin";

/**
 * Chrome 확장 manifest (MV3).
 * 확장은 의도적으로 얇게 — music.youtube.com 에서 좋아요 목록을 수집해
 * 백엔드로 보내는 역할만 한다. 사용자 본인 세션 내에서만 동작한다.
 *
 * 수집 전략:
 *  - inject.ts (MAIN world, document_start): 페이지의 fetch 를 패치해
 *    youtubei/v1/browse 응답을 가로챈다.
 *  - content.ts (ISOLATED world): 가로챈 응답을 파싱·누적하고 자동 스크롤로
 *    전체 목록을 로드한 뒤 background 로 넘긴다.
 */
export default defineManifest({
  manifest_version: 3,
  name: "Playlist Analyzer — YT Music 수집기",
  version: "0.1.0",
  description: "유튜브 뮤직 좋아요 곡 목록을 수집해 Playlist Analyzer 로 보냅니다.",
  permissions: ["storage", "tabs"],
  // workers.dev 백엔드를 host_permissions 에 포함 → 확장 fetch 가
  // CORS 대상에서 제외되어 업로드가 안정적이다.
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
