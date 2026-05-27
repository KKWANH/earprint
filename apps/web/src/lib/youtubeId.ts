/**
 * YouTube video ID parser. Accepts the half-dozen URL shapes YouTube
 * actually serves (full / short / shorts / embed) plus a bare ID, and
 * returns the 11-character video ID — or null when the input doesn't
 * resolve.
 *
 * Used at UGC worldcup create time so the user can paste any YouTube
 * URL shape and the backend stores just the canonical videoId.
 */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeVideoId(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  // Bare 11-char ID — accept as-is.
  if (VIDEO_ID_RE.test(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  // youtu.be/<id>
  if (host === "youtu.be") {
    const seg = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return VIDEO_ID_RE.test(seg) ? seg : null;
  }
  // youtube.com / music.youtube.com / m.youtube.com / youtube-nocookie.com
  if (
    host === "youtube.com" ||
    host === "music.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    // /watch?v=...
    const v = parsed.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return v;
    // /shorts/<id> or /embed/<id> or /v/<id>
    const segs = parsed.pathname.split("/").filter(Boolean);
    if (segs.length >= 2 && ["shorts", "embed", "v"].includes(segs[0]!)) {
      const id = segs[1]!;
      if (VIDEO_ID_RE.test(id)) return id;
    }
  }
  return null;
}

export interface OEmbedMeta {
  title: string;
  author: string;
  thumbnail: string;
}

/**
 * Fetches title/author/thumbnail for a videoId via YouTube's public
 * oEmbed endpoint — no API key required, no quota. Returns null on
 * any failure (network, 404, missing fields) so the caller can fall
 * back to a user-supplied title.
 */
export async function fetchYouTubeOEmbed(videoId: string): Promise<OEmbedMeta | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D${encodeURIComponent(videoId)}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      title?: unknown;
      author_name?: unknown;
      thumbnail_url?: unknown;
    };
    const title = typeof d.title === "string" ? d.title : "";
    const author = typeof d.author_name === "string" ? d.author_name : "";
    const thumb = typeof d.thumbnail_url === "string" ? d.thumbnail_url : "";
    if (!title) return null;
    return { title, author, thumbnail: thumb };
  } catch {
    return null;
  }
}
