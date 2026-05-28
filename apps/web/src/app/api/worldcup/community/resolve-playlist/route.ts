import { z } from "zod";
import { auth } from "@/auth";
import { json, readJsonBody } from "@/lib/http";
import {
  extractPlaylistId,
  fetchPlaylistItems,
  isPrivatePlaylistId,
} from "@/lib/youtube-playlist";

/**
 * POST /api/worldcup/community/resolve-playlist
 *
 * Body: `{ url: string }` — any YouTube playlist URL (or bare list ID).
 *
 * Resolves the playlist via YT Data API v3 (key restricted by HTTP
 * referrer in GCP Console) and returns the video metadata so the
 * /worldcup/community/create form can pre-fill its URL rows.
 *
 * Auth gate: signed-in users only. Anonymous resolves are blocked to
 * avoid randos burning our 10k/day quota — community-create itself is
 * already auth-gated for the same reason.
 *
 * Quota: each call ≈ 1 unit (1 page of 50). A 200-item playlist costs
 * 4 units. The endpoint hard-caps at 4 pages so even a giant playlist
 * doesn't burn the daily budget on one request.
 */
const Body = z.object({
  url: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);

  const parsed = await readJsonBody<unknown>(req, 4 * 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);

  const playlistId = extractPlaylistId(v.data.url);
  if (!playlistId) {
    return json(
      {
        error:
          "Couldn't read a YouTube playlist URL. Paste a https://youtube.com/playlist?list=… link.",
      },
      400,
    );
  }
  if (isPrivatePlaylistId(playlistId)) {
    return json(
      {
        error:
          "YouTube doesn't let third parties read your personal playlists (Liked / Watch Later) over the public API. Copy/paste the videos instead, or move them to a public playlist first.",
      },
      400,
    );
  }

  const apiKey = process.env.YT_DATA_API_KEY;
  if (!apiKey) {
    // Surfaced to the user as a generic "unavailable" — don't leak
    // that the secret is missing, just behave like the feature isn't
    // enabled on this deploy.
    return json({ error: "playlist import is not available" }, 503);
  }

  const items = await fetchPlaylistItems(playlistId, apiKey);
  if (items === null) {
    return json(
      {
        error:
          "Couldn't load that playlist — it might be private, deleted, or the link could be wrong.",
      },
      404,
    );
  }
  if (items.length === 0) {
    return json(
      { error: "This playlist has no playable videos." },
      404,
    );
  }

  return json({ ok: true, playlistId, items, count: items.length }, 200);
}
