import type { CapturedTrack } from "@playlist-analyzer/shared";

/**
 * Wrapper around the YouTube Data API v3 `playlistItems.list` endpoint.
 * Used by the API-mode sync path (/api/sync-yt) to fetch the user's Liked
 * Videos playlist as a fallback to the Chrome extension.
 *
 * Coverage caveat: the Data API exposes YouTube's "Liked Videos" (LL), not
 * YouTube Music's "Liked Songs". The two overlap heavily for users whose
 * likes are music videos with proper YT video equivalents, but pure-audio
 * YT Music likes (artist-uploaded only-music with no MV) may be absent.
 */

interface YtPlaylistItem {
  contentDetails: { videoId: string; videoPublishedAt?: string };
  snippet: {
    title: string;
    videoOwnerChannelTitle?: string;
    channelTitle?: string;
    publishedAt?: string;
  };
}

interface YtListResponse {
  items: YtPlaylistItem[];
  nextPageToken?: string;
  pageInfo?: { totalResults?: number };
}

interface YtVideoMeta {
  id: string;
  snippet?: { categoryId?: string };
}
interface YtVideosResponse {
  items?: YtVideoMeta[];
}

/**
 * Filters a batch of videoIds down to ones in YouTube's "Music" category
 * (categoryId = "10"). The LL ("Liked Videos") playlist mixes music with
 * vlogs, gaming clips, tutorials, etc. — without this filter, a user with
 * 5k liked YouTube videos but only 500 actual songs would get all 5k
 * dumped into their Earprint library as "tracks".
 *
 * One videos.list call per 50 IDs (the API max). Quota cost is the same
 * as playlistItems.list (1 unit), so this roughly doubles the per-page
 * quota — still trivially within the 10k/day default project quota.
 */
async function filterMusicCategory(
  accessToken: string,
  videoIds: string[],
): Promise<Set<string>> {
  if (videoIds.length === 0) return new Set();
  const musicIds = new Set<string>();
  // 50 IDs per call — the videos.list cap. A typical chunk of 250
  // playlist items takes 5 of these calls.
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("maxResults", "50");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      // Don't throw — a partial-quality filter is better than zero
      // music tracks captured. Worst case we accept some non-music
      // and let the user delete from their library; the alternative
      // is an opaque "0 tracks captured" message.
      continue;
    }
    const json = (await res.json()) as YtVideosResponse;
    for (const v of json.items ?? []) {
      if (v.snippet?.categoryId === "10" && v.id) musicIds.add(v.id);
    }
  }
  return musicIds;
}

/**
 * Pulls one chunk of the LL playlist (Liked Videos), resumable via pageToken.
 *
 * Cloudflare Workers cap each invocation at 50 subrequests (free) / 1,000
 * (paid). 50 × 50 = 2,500 likes per call would already be tight, so we
 * default to 5 pages (250 tracks) per chunk — leaves headroom for the DB
 * roundtrip and keeps the worker well inside its budget. The caller passes
 * the returned `nextPageToken` back in to fetch the next chunk.
 */
export async function fetchLikedVideos(
  accessToken: string,
  opts: { maxPages?: number; pageToken?: string } = {},
): Promise<{
  items: YtPlaylistItem[];
  total: number;
  nextPageToken: string | null;
  /** How many items came back from playlistItems.list before the music
   *  filter. Surfaced in the API response so /connect can show
   *  "captured 47 music tracks (filtered from 250 liked videos)". */
  rawCount: number;
}> {
  const maxPages = opts.maxPages ?? 5;
  const raw: YtPlaylistItem[] = [];
  let pageToken: string | undefined = opts.pageToken;
  let total = 0;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "contentDetails,snippet");
    url.searchParams.set("playlistId", "LL");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new YouTubeApiError(res.status, body);
    }
    const json = (await res.json()) as YtListResponse;
    raw.push(...(json.items ?? []));
    total = json.pageInfo?.totalResults ?? total;
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  // Filter to YouTube category 10 (Music) — see filterMusicCategory note.
  // Without this the LL playlist dumps movies, vlogs, gaming, recipes,
  // anything the user has ever liked into their music library, which
  // poisons every downstream feature (Zodiac, genre analysis, recs).
  const videoIds = raw
    .map((it) => it.contentDetails?.videoId)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const musicIds = await filterMusicCategory(accessToken, videoIds);
  const items = raw.filter((it) => musicIds.has(it.contentDetails?.videoId ?? ""));

  return { items, total, nextPageToken: pageToken ?? null, rawCount: raw.length };
}

/** Typed error so callers can react to 401 (expired token) vs everything else. */
export class YouTubeApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`YouTube API ${status}: ${body.slice(0, 200)}`);
    this.name = "YouTubeApiError";
  }
}

/**
 * Heuristic parse of YouTube video titles into (title, artist). YouTube
 * music videos are most often "Artist - Song" or "Artist - Song (Official…)".
 * Falls back to the uploader channel as the artist when the dash form is
 * absent.
 */
export function parseTitle(
  rawTitle: string,
  channel: string | undefined,
): { title: string; artist: string } {
  const cleaned = rawTitle
    // Strip noisy parentheticals that aren't part of the actual title.
    .replace(
      /\s*[([](?:official|official\s+(?:video|music\s+video|audio|mv|m\/v)|m\/v|mv|audio|lyrics?|lyric\s+video|hd|4k|live|performance|visualizer|color\s+coded|eng\s+sub)[^)\]]*[)\]]/gi,
      "",
    )
    .replace(/\s+\|\s+.*$/, "") // " | Featured on …" tail
    .trim();

  // "Artist - Song" — the dominant YT music-video format.
  const dashMatch = cleaned.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dashMatch) {
    return { artist: dashMatch[1]!.trim(), title: dashMatch[2]!.trim() };
  }

  // "Song by Artist" / "Song – Artist (uploaded by artist's channel)" — rare
  // but worth catching. Otherwise, treat the whole title as the song and use
  // the uploader as the artist.
  const byMatch = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { artist: byMatch[2]!.trim(), title: byMatch[1]!.trim() };
  }

  // Channels named "X - Topic" are YouTube's auto-generated music channels —
  // the prefix is the actual artist.
  const fallbackArtist = (channel ?? "")
    .replace(/\s+-\s+Topic$/i, "")
    .trim() || "Unknown";

  return { artist: fallbackArtist, title: cleaned };
}

/** Maps the YouTube API response into the shape `sync_liked_tracks` expects. */
export function toCapturedTracks(items: YtPlaylistItem[]): CapturedTrack[] {
  return items
    .filter((it) => it.contentDetails?.videoId)
    .map((it) => {
      const channel = it.snippet?.videoOwnerChannelTitle ?? it.snippet?.channelTitle;
      const { title, artist } = parseTitle(it.snippet?.title ?? "", channel);
      const t: CapturedTrack = {
        videoId: it.contentDetails.videoId,
        title,
        artist,
      };
      // Playlist `publishedAt` from snippet is when the user liked it.
      const likedAt = it.snippet?.publishedAt;
      if (likedAt) t.likedAt = likedAt;
      return t;
    });
}

/**
 * Refreshes an expired Google access token using the refresh token. Returns
 * the new access token and the new expiry (unix seconds). Throws on failure.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials not configured");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Refresh failed: ${res.status} ${body}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + json.expires_in,
  };
}
