/**
 * YouTube Music InnerTube(youtubei/v1/browse) 응답에서 트랙을 추출한다.
 *
 * 응답 구조는 자주 바뀌므로, 정해진 경로를 따라가는 대신
 * `musicResponsiveListItemRenderer` 를 깊이우선으로 전부 찾아 파싱한다.
 */
import type { CapturedTrack } from "@playlist-analyzer/shared";

type Json = Record<string, unknown>;

/** 응답 트리를 순회하며 모든 트랙을 out 맵(videoId 기준)에 모은다. */
export function extractTracks(node: unknown, out: Map<string, CapturedTrack>): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) extractTracks(child, out);
    return;
  }
  const obj = node as Json;
  const renderer = obj["musicResponsiveListItemRenderer"];
  if (renderer && typeof renderer === "object") {
    const track = parseItem(renderer as Json);
    if (track) out.set(track.videoId, track);
  }
  for (const key of Object.keys(obj)) extractTracks(obj[key], out);
}

function parseItem(item: Json): CapturedTrack | null {
  const videoId = findVideoId(item);
  if (!videoId) return null;

  const flex = (item["flexColumns"] as unknown[]) ?? [];
  const title = runsText(flex[0]);
  if (!title) return null;

  // flexColumns[1] 은 보통 "아티스트 • 앨범 • 연도" 형태 — 첫 구획만 아티스트로.
  const artistRaw = runsText(flex[1]);
  const artist = artistRaw.split("•")[0]?.trim() || "Unknown";

  const fixed = (item["fixedColumns"] as unknown[]) ?? [];
  const durationMs = parseDuration(runsText(fixed[0]));

  const track: CapturedTrack = { videoId, title, artist };
  if (durationMs != null) track.durationMs = durationMs;
  return track;
}

/** 객체 트리에서 videoId 를 찾는다 (playlistItemData 우선, 그다음 watchEndpoint). */
function findVideoId(node: unknown): string | null {
  const fromPlaylist = deepGet(node, "playlistItemData", "videoId");
  if (typeof fromPlaylist === "string") return fromPlaylist;
  const fromWatch = deepFindKey(node, "watchEndpoint");
  if (fromWatch && typeof fromWatch === "object") {
    const vid = (fromWatch as Json)["videoId"];
    if (typeof vid === "string") return vid;
  }
  return null;
}

/** 컬럼 객체 안에서 첫 번째 { text: { runs: [...] } } 를 찾아 텍스트를 잇는다. */
function runsText(column: unknown): string {
  const runs = deepFindKey(column, "runs");
  if (!Array.isArray(runs)) return "";
  return runs
    .map((r) => (r && typeof r === "object" ? (r as Json)["text"] : ""))
    .filter((t): t is string => typeof t === "string")
    .join("");
}

/** "m:ss" 또는 "h:mm:ss" → 밀리초. */
function parseDuration(text: string): number | null {
  const parts = text.trim().split(":").map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  const seconds = parts.reduce((acc, n) => acc * 60 + n, 0);
  return seconds * 1000;
}

function deepGet(node: unknown, parentKey: string, childKey: string): unknown {
  const parent = deepFindKey(node, parentKey);
  if (parent && typeof parent === "object") return (parent as Json)[childKey];
  return undefined;
}

/** 트리에서 주어진 key 의 첫 값을 깊이우선으로 찾는다. */
function deepFindKey(node: unknown, key: string): unknown {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = deepFindKey(child, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const obj = node as Json;
  if (key in obj) return obj[key];
  for (const k of Object.keys(obj)) {
    const found = deepFindKey(obj[k], key);
    if (found !== undefined) return found;
  }
  return undefined;
}
