/**
 * YouTube Data API v3 — playlist resolver. Given a user-pasted
 * playlist URL (any of the half-dozen YouTube playlist URL shapes),
 * returns the first 50 video metadata rows so a community-worldcup
 * creator can bulk-import without copy-pasting 16-32 URLs by hand.
 *
 * Why YT Data API instead of oEmbed: oEmbed is per-video only — it
 * doesn't expose any way to enumerate items in a playlist. The Data
 * API's `playlistItems.list` is the only public path that does, and
 * an API-key call against public playlists requires no OAuth (the
 * user doesn't need to be the playlist owner — same access level as
 * an anonymous viewer hitting the playlist URL in a browser).
 *
 * Quota: each `playlistItems.list` call costs **1 unit** against the
 * project's 10,000/day default quota. We paginate at maxResults=50,
 * cap the whole resolve at 4 pages (200 items max) — enough for any
 * bracket the create UI allows (4-32) plus headroom for filtering
 * out private/deleted videos.
 */
const API = "https://www.googleapis.com/youtube/v3/playlistItems";
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{13,64}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
// Conservative ceiling so a single import never burns 10+ quota
// units. 200 items is 4× the 50-item bracket cap we currently
// support, which gives ~40% headroom for filtering out unavailable
// items without hitting the user-visible "playlist exceeds limit"
// path.
const HARD_CAP = 200;

export interface PlaylistItem {
  videoId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
}

/**
 * Extract the playlist ID from any reasonable YouTube playlist URL,
 * or null when the input doesn't match. Accepted shapes:
 *   - https://www.youtube.com/playlist?list=PLxxx
 *   - https://www.youtube.com/watch?v=...&list=PLxxx (watch URL with playlist)
 *   - https://music.youtube.com/playlist?list=PLxxx
 *   - https://m.youtube.com/playlist?list=PLxxx
 *   - bare playlist ID (starts with PL/UU/LL/FL/RD and is 13+ chars)
 *
 * Personal "Liked songs" (LM) and "Watch later" (WL) are intentionally
 * NOT supported — they're private to the account that owns them, so
 * an API-key call returns 404. Reject early with a useful message
 * upstream.
 */
export function extractPlaylistId(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (PLAYLIST_ID_RE.test(trimmed)) return trimmed;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (
    host !== "youtube.com" &&
    host !== "music.youtube.com" &&
    host !== "m.youtube.com" &&
    host !== "youtu.be"
  ) {
    return null;
  }
  const list = parsed.searchParams.get("list");
  if (list && PLAYLIST_ID_RE.test(list)) return list;
  return null;
}

/**
 * Some playlist IDs are visible-to-owner-only and YT Data API rejects
 * them with 404 even with a valid key. Flag those up-front so the
 * caller can give a useful error instead of "unknown error".
 */
export function isPrivatePlaylistId(id: string): boolean {
  return id === "LM" || id === "WL";
}

interface RawItem {
  snippet?: {
    title?: string;
    videoOwnerChannelTitle?: string;
    channelTitle?: string;
    thumbnails?: Record<string, { url?: string } | undefined>;
    resourceId?: { videoId?: string; kind?: string };
  };
}

/**
 * Fetch up to HARD_CAP items from a playlist via paginated calls.
 * Each call returns 50; we paginate via `pageToken` until we hit the
 * cap or the response stops including nextPageToken. Filters out
 * items that are deleted ("Deleted video"), private ("Private video"),
 * or that the API returns without a usable videoId.
 *
 * Returns `null` when the API rejected the call (bad key, quota
 * exceeded, 404 playlist, network down) — caller surfaces that as a
 * generic "couldn't load this playlist" error to the user without
 * leaking which specific failure happened.
 */
export async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string,
): Promise<PlaylistItem[] | null> {
  if (!apiKey || !PLAYLIST_ID_RE.test(playlistId)) return null;

  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;
  // Safety bound — even with nextPageToken returning forever we cap.
  for (let page = 0; page < 4 && items.length < HARD_CAP; page++) {
    const url =
      `${API}?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}` +
      `&key=${encodeURIComponent(apiKey)}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    } catch {
      return items.length > 0 ? items : null;
    }
    if (!res.ok) return items.length > 0 ? items : null;
    const data = (await res.json().catch(() => null)) as {
      items?: RawItem[];
      nextPageToken?: string;
    } | null;
    if (!data || !Array.isArray(data.items)) break;
    for (const raw of data.items) {
      const snip = raw.snippet;
      if (!snip) continue;
      const videoId = snip.resourceId?.videoId;
      if (!videoId || !VIDEO_ID_RE.test(videoId)) continue;
      const title = (snip.title ?? "").trim();
      // Drop the YT-reserved placeholder titles for unavailable items.
      // These come through with a videoId that won't play either, so
      // there's no point letting the user pick them.
      if (!title || title === "Private video" || title === "Deleted video") continue;
      // Pick the largest thumbnail available. The default order on YT's
      // response object is `default | medium | high | standard | maxres`
      // — we want the biggest that's actually present.
      const thumbs = snip.thumbnails ?? {};
      const thumbUrl =
        thumbs.maxres?.url ??
        thumbs.standard?.url ??
        thumbs.high?.url ??
        thumbs.medium?.url ??
        thumbs.default?.url ??
        null;
      // Restrict to YT's own CDNs so a corrupted API response can't
      // sneak a different host into our DB / <img src>.
      const SAFE_THUMB = /^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\//;
      const safeThumb = thumbUrl && SAFE_THUMB.test(thumbUrl) ? thumbUrl : null;
      items.push({
        videoId,
        title,
        channelTitle:
          (snip.videoOwnerChannelTitle ?? snip.channelTitle ?? "").trim() ||
          null,
        thumbnailUrl: safeThumb,
      });
      if (items.length >= HARD_CAP) break;
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}
