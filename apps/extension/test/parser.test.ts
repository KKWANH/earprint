/**
 * parser.ts 단위 테스트 — 실제 브라우저 없이 InnerTube 응답 픽스처로 검증.
 * 실행: node --test apps/extension/test/parser.test.ts
 *
 * 픽스처는 YouTube Music youtubei/v1/browse 응답의 알려진 구조를 모사한다.
 * 실제 응답으로 교체하면 회귀 테스트로 그대로 쓸 수 있다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { extractTracks } from "../src/parser.ts";

/* ── 픽스처 빌더 ──────────────────────────────────────── */

const run = (text) => ({ text });

const flexCol = (...texts) => ({
  musicResponsiveListItemFlexColumnRenderer: { text: { runs: texts.map(run) } },
});

const fixedCol = (text) => ({
  musicResponsiveListItemFixedColumnRenderer: { text: { runs: [run(text)] } },
});

function item({ title, artistRuns, duration, videoId, watchVideoId }) {
  const renderer: Record<string, unknown> = {
    flexColumns: [flexCol(title), flexCol(...artistRuns)],
    fixedColumns: duration ? [fixedCol(duration)] : [],
  };
  if (videoId) renderer.playlistItemData = { videoId };
  if (watchVideoId) {
    renderer.overlay = {
      musicItemThumbnailOverlayRenderer: {
        content: {
          musicPlayButtonRenderer: {
            playNavigationEndpoint: { watchEndpoint: { videoId: watchVideoId } },
          },
        },
      },
    };
  }
  return { musicResponsiveListItemRenderer: renderer };
}

const itemPlastic = item({
  title: "Plastic Love",
  artistRuns: ["Mariya Takeuchi", " • ", "Variety"],
  duration: "4:55",
  videoId: "VID_PLASTIC",
});

// videoId 가 playlistItemData 가 아니라 watchEndpoint 에만 있는 경우
const itemWatch = item({
  title: "Stay With Me",
  artistRuns: ["Miki Matsubara"],
  duration: "1:02:33",
  watchVideoId: "VID_WATCH",
});

// videoId 가 전혀 없는 항목 → 건너뛰어야 함
const itemNoVid = item({
  title: "Broken Row",
  artistRuns: ["Nobody"],
  duration: "3:00",
});

const itemFour = item({
  title: "Midnight Pretenders",
  artistRuns: ["Tomoko Aran"],
  duration: "5:21",
  videoId: "VID_FOUR",
});

// 초기 browse 응답 — 실제 구조처럼 깊게 중첩
const browseResponse = {
  contents: {
    singleColumnBrowseResultsRenderer: {
      tabs: [
        {
          tabRenderer: {
            content: {
              sectionListRenderer: {
                contents: [
                  {
                    musicPlaylistShelfRenderer: {
                      contents: [itemPlastic, itemWatch, itemNoVid],
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    },
  },
};

// continuation(스크롤 시 추가 로드) 응답 — itemPlastic 이 다시 등장(중복)
const continuationResponse = {
  continuationContents: {
    musicPlaylistShelfContinuation: {
      contents: [itemFour, itemPlastic],
    },
  },
};

/* ── 테스트 ──────────────────────────────────────────── */

test("browse 응답에서 트랙을 추출한다", () => {
  const out = new Map();
  extractTracks(browseResponse, out);
  // itemNoVid 는 videoId 가 없어 제외 → 2곡
  assert.equal(out.size, 2);
});

test("제목·아티스트를 파싱하고 ' • ' 뒤(앨범)를 잘라낸다", () => {
  const out = new Map();
  extractTracks(browseResponse, out);
  const t = out.get("VID_PLASTIC");
  assert.equal(t.title, "Plastic Love");
  assert.equal(t.artist, "Mariya Takeuchi");
  assert.equal(t.videoId, "VID_PLASTIC");
});

test("m:ss 길이를 밀리초로 변환한다", () => {
  const out = new Map();
  extractTracks(browseResponse, out);
  assert.equal(out.get("VID_PLASTIC").durationMs, (4 * 60 + 55) * 1000);
});

test("h:mm:ss 길이를 처리한다", () => {
  const out = new Map();
  extractTracks(browseResponse, out);
  assert.equal(out.get("VID_WATCH").durationMs, (1 * 3600 + 2 * 60 + 33) * 1000);
});

test("playlistItemData 가 없으면 watchEndpoint 에서 videoId 를 찾는다", () => {
  const out = new Map();
  extractTracks(browseResponse, out);
  assert.ok(out.has("VID_WATCH"));
  assert.equal(out.get("VID_WATCH").title, "Stay With Me");
});

test("videoId 없는 항목은 건너뛴다", () => {
  const out = new Map();
  extractTracks(browseResponse, out);
  const titles = [...out.values()].map((t) => t.title);
  assert.ok(!titles.includes("Broken Row"));
});

test("여러 응답에 걸쳐 videoId 로 중복 제거한다", () => {
  const out = new Map();
  extractTracks(browseResponse, out);
  extractTracks(continuationResponse, out);
  // VID_PLASTIC, VID_WATCH (초기) + VID_FOUR (continuation), VID_PLASTIC 중복
  assert.equal(out.size, 3);
  assert.ok(out.has("VID_FOUR"));
});

test("빈/잘못된 입력에 안전하다", () => {
  const out = new Map();
  extractTracks(null, out);
  extractTracks(undefined, out);
  extractTracks({}, out);
  extractTracks([1, 2, "x"], out);
  assert.equal(out.size, 0);
});
