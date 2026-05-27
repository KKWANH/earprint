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
 *
 * Music filtering: LL mixes vlogs / gaming / cooking / interviews /
 * podcasts in with the music. We score each item from several signals
 * before sync — see scoreMusicLikelihood() — so a user with 5k liked
 * videos but only 500 songs doesn't get 4,500 random YouTube videos
 * poisoning their Earprint library.
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
  snippet?: {
    title?: string;
    categoryId?: string;
    channelTitle?: string;
  };
  contentDetails?: { duration?: string };
  topicDetails?: { topicCategories?: string[] };
}
interface YtVideosResponse {
  items?: YtVideoMeta[];
}

/** Tracks that look like music but the parser didn't recognise — returned
 *  to the caller so the UI can show "we skipped 392 of your 1,234 likes
 *  because they didn't look like songs" + a sample list for verification. */
export interface SkippedSample {
  videoId: string;
  title: string;
  /** Best-guess single-word reason ("short", "long", "non-music", "vlog"). */
  reason: string;
}

/**
 * Parse an ISO 8601 duration (PT3M45S → 225 seconds). Used for the
 * duration-based filtering — too short = Short, too long = compilation
 * / podcast / livestream. Returns 0 on parse failure (= treat as
 * neutral).
 */
function parseIsoDuration(d?: string): number {
  if (!d) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Wikipedia URL slugs YouTube uses for music-genre topics. Hitting any
 *  of these is a strong "this video is music" signal — much more
 *  reliable than category=10 alone because uploads frequently mis-tag
 *  category (Comedy / Entertainment) while still carrying the right
 *  topic. URL-decoded compare so R%26B etc. match. */
const MUSIC_TOPIC_RE =
  /\/(Music|Pop_music|Rock_music|Hip_hop_music|Electronic_music|Classical_music|Jazz|Country_music|Reggae|Folk_music|Soul_music|Rhythm_and_blues|Heavy_metal|Independent_music|Christian_music)$/i;

/**
 * Composite music-likelihood score for one YouTube video.
 *
 * Signals (additive):
 *   +3   categoryId = 10 (Music)
 *   +2   topicDetails matches a music-genre Wikipedia category
 *   +2   channelTitle ends with " - Topic" (YT auto-music channel)
 *   +2   channelTitle ends with "VEVO" (VEVO official)
 *   +1   title has the "Official Music Video / MV / Lyric Video" tells
 *   -3   duration < 30s (Short)
 *   -2   duration > 15 min (compilation / interview / podcast / livestream)
 *   -3   title matches reaction / interview / tutorial / vlog / podcast etc.
 *
 * Threshold to keep: score ≥ 2. The intent is "either category+anything,
 * or topic match alone, or strong channel signal alone, qualifies".
 * Below threshold the item becomes a SkippedSample with the highest-
 * weight negative reason as the explanation.
 */
function scoreItem(item: YtVideoMeta): { score: number; reason: string } {
  let score = 0;
  let primaryNegative = "";

  if (item.snippet?.categoryId === "10") score += 3;

  const topics = item.topicDetails?.topicCategories ?? [];
  if (topics.some((t) => MUSIC_TOPIC_RE.test(t))) score += 2;

  const dur = parseIsoDuration(item.contentDetails?.duration);
  if (dur > 0 && dur < 30) {
    score -= 3;
    primaryNegative ||= "short";
  } else if (dur > 900) {
    score -= 2;
    primaryNegative ||= "long";
  }

  const title = item.snippet?.title ?? "";
  if (
    /\b(official\s+(?:music\s+)?video|official\s+audio|m\/v|\bmv\b|lyric\s+video|visualizer|topic)\b/i.test(
      title,
    )
  ) {
    score += 1;
  }
  if (
    /\b(interview|reaction|tutorial|review|gameplay|vlog|podcast|reading|asmr|news|recipe|cooking|let'?s\s+play|how\s+to|montage|trailer|highlight|unboxing|q&a|q\s*and\s*a|press\s+conference|behind\s+the\s+scenes|bts\s+footage|press\s+tour)\b/i.test(
      title,
    )
  ) {
    score -= 3;
    primaryNegative ||= "non-music";
  }

  const channel = item.snippet?.channelTitle ?? "";
  if (/\s-\sTopic$/i.test(channel)) score += 2;
  if (/VEVO$/i.test(channel)) score += 2;

  // The "reason" makes sense only when we're rejecting — fall back to
  // a generic "low-score" when nothing specific tripped.
  const reason = primaryNegative || "low-score";
  return { score, reason };
}

/**
 * Multi-signal music filter for a batch of videoIds. Fetches snippet +
 * topicDetails + contentDetails in one videos.list call per 50 IDs,
 * then scores each item via scoreItem(). Returns:
 *   - musicIds: items that scored ≥ KEEP_THRESHOLD
 *   - excludedSamples: the first ~12 below-threshold items with a
 *     human reason, so the UI can show why we skipped them
 *
 * Quota: one videos.list call per 50 IDs (1 unit each) — same cost as
 * the old category-only filter, with much higher signal density.
 */
const KEEP_THRESHOLD = 2;

async function scoreMusicLikelihood(
  accessToken: string,
  videoIds: string[],
): Promise<{ musicIds: Set<string>; excludedSamples: SkippedSample[] }> {
  if (videoIds.length === 0) {
    return { musicIds: new Set(), excludedSamples: [] };
  }
  const musicIds = new Set<string>();
  const excludedSamples: SkippedSample[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,topicDetails,contentDetails");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("maxResults", "50");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      // Soft-fail: keep everything in this batch on filter error rather
      // than dropping it. The downstream Deezer matcher will weed out
      // pure-noise items via low confidence; we'd rather over-include
      // than silently lose a user's library.
      for (const id of batch) musicIds.add(id);
      continue;
    }
    const json = (await res.json()) as YtVideosResponse;
    for (const v of json.items ?? []) {
      if (!v.id) continue;
      const { score, reason } = scoreItem(v);
      if (score >= KEEP_THRESHOLD) {
        musicIds.add(v.id);
      } else if (excludedSamples.length < 12) {
        excludedSamples.push({
          videoId: v.id,
          title: v.snippet?.title ?? "(no title)",
          reason,
        });
      }
    }
  }
  return { musicIds, excludedSamples };
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
   *  filter — surfaced so /connect can show "captured 47 music tracks
   *  from 250 liked videos". */
  rawCount: number;
  /** How many of those rawCount items the multi-signal filter rejected. */
  skippedCount: number;
  /** Up to ~12 representative rejected items so the UX can show
   *  "we skipped these — was that right?". */
  skippedSamples: SkippedSample[];
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

  const videoIds = raw
    .map((it) => it.contentDetails?.videoId)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const { musicIds, excludedSamples } = await scoreMusicLikelihood(
    accessToken,
    videoIds,
  );
  const items = raw.filter((it) => musicIds.has(it.contentDetails?.videoId ?? ""));

  return {
    items,
    total,
    nextPageToken: pageToken ?? null,
    rawCount: raw.length,
    skippedCount: raw.length - items.length,
    skippedSamples: excludedSamples,
  };
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
 *
 * Channel signals:
 *   - "X - Topic" → X is the canonical artist (YT auto-music channel)
 *   - "XVEVO" → X is the canonical artist (VEVO upload)
 *   - any other channel: only used when the title doesn't already contain
 *     an explicit Artist - Song split
 */
export function parseTitle(
  rawTitle: string,
  channel: string | undefined,
): { title: string; artist: string } {
  const cleaned = rawTitle
    // Strip noisy parentheticals that aren't part of the actual title.
    // The list catches the common YT music-video tag patterns; missing
    // any specific noise tag just means a slightly dirtier title, not a
    // wrong match.
    .replace(
      /\s*[([](?:official|official\s+(?:video|music\s+video|audio|mv|m\/v)|m\/v|mv|audio|lyrics?|lyric\s+video|hd|4k|live|performance|visualizer|color\s+coded|eng\s+sub|color\s+coded\s+lyrics|color\s+coded\s+han\/rom\/eng)[^)\]]*[)\]]/gi,
      "",
    )
    .replace(/\s+\|\s+.*$/, "") // " | Featured on …" tail
    .trim();

  // Topic / VEVO channels: artist is the channel prefix, title is the
  // already-cleaned video title. These are higher-confidence signals
  // than parsing the title for a dash, so they take precedence.
  if (channel) {
    const topicMatch = channel.match(/^(.+?)\s+-\s+Topic$/i);
    if (topicMatch) return { artist: topicMatch[1]!.trim(), title: cleaned };
    const vevoMatch = channel.match(/^(.+?)VEVO$/i);
    if (vevoMatch) return { artist: vevoMatch[1]!.trim(), title: cleaned };
  }

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

  // Channels named "X - Topic" handled above; remaining channels fall
  // through as the artist guess.
  const fallbackArtist = (channel ?? "").trim() || "Unknown";
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
