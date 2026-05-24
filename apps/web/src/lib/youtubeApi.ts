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

/** Pulls the entire LL playlist (Liked Videos), paginated. */
export async function fetchLikedVideos(
  accessToken: string,
  opts: { maxPages?: number } = {},
): Promise<{ items: YtPlaylistItem[]; total: number }> {
  const maxPages = opts.maxPages ?? 250; // 250 × 50 = 12,500 — enough for most libraries
  const items: YtPlaylistItem[] = [];
  let pageToken: string | undefined;
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
    items.push(...(json.items ?? []));
    total = json.pageInfo?.totalResults ?? total;
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return { items, total };
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
