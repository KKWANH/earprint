/**
 * Extracts tracks from YouTube Music InnerTube (youtubei/v1/browse) responses.
 *
 * The response structure changes often, so instead of following a fixed path,
 * we depth-first find and parse every `musicResponsiveListItemRenderer`.
 */
import type { CapturedTrack } from "@playlist-analyzer/shared";

type Json = Record<string, unknown>;

/** Walks the response tree and collects every track into the out map (keyed by videoId). */
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

/**
 * True if the response still carries a continuation token — i.e. more pages
 * remain. Used to detect the true end of the list instead of guessing from
 * how fast new tracks arrive.
 */
export function hasContinuation(node: unknown): boolean {
  return (
    deepFindKey(node, "continuationItemRenderer") !== undefined ||
    deepFindKey(node, "nextContinuationData") !== undefined
  );
}

function parseItem(item: Json): CapturedTrack | null {
  const videoId = findVideoId(item);
  if (!videoId) return null;

  const flex = (item["flexColumns"] as unknown[]) ?? [];
  const title = runsText(flex[0]);
  if (!title) return null;

  // flexColumns[1] is usually "artist • album • year" — take only the first segment as the artist.
  const artistRaw = runsText(flex[1]);
  const artist = artistRaw.split("•")[0]?.trim() || "Unknown";

  // The liked-songs table also carries an album column (flexColumns[2]).
  const album = runsText(flex[2]).split("•")[0]?.trim() ?? "";

  const fixed = (item["fixedColumns"] as unknown[]) ?? [];
  const durationMs = parseDuration(runsText(fixed[0]));

  const track: CapturedTrack = { videoId, title, artist };
  if (album && album !== artist) track.album = album;
  if (durationMs != null) track.durationMs = durationMs;
  return track;
}

/** Finds videoId in the object tree (playlistItemData first, then watchEndpoint). */
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

/** Finds the first { text: { runs: [...] } } inside a column object and joins the text. */
function runsText(column: unknown): string {
  const runs = deepFindKey(column, "runs");
  if (!Array.isArray(runs)) return "";
  return runs
    .map((r) => (r && typeof r === "object" ? (r as Json)["text"] : ""))
    .filter((t): t is string => typeof t === "string")
    .join("");
}

/** "m:ss" or "h:mm:ss" → milliseconds. */
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

/** Depth-first finds the first value for the given key in the tree. */
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
