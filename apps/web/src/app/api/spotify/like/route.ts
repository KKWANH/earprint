import { z } from "zod";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { json, readJsonBody } from "@/lib/http";
import { getActiveSpotifyConnection, spotifyFetch } from "@/lib/spotify";

/**
 * POST /api/spotify/like
 *
 * Adds a track to the user's Spotify Liked Songs library. Powers the
 * "♥ Save to Spotify" button on community worldcup champions — same
 * tap target as the existing "Like in YT Music" deep-link, but
 * actually performs the action via Spotify Web API instead of
 * bouncing the user to a search page.
 *
 * Body: { trackId?: string, query?: string }
 *   trackId — Spotify track ID. Preferred when available (e.g. the
 *             champion item was originally pulled from Spotify and
 *             we have its source_id). One API call.
 *   query   — fallback: "artist - title" string. We /search Spotify
 *             for it, then PUT the top hit's id. Two API calls.
 *
 * Auth: signed-in + Spotify connected. Scope check is implicit —
 * Spotify itself rejects with 403 when the token lacks
 * user-library-modify (the granted set is captured per connection
 * in spotify_connections.scope at consent time).
 */
const Body = z.object({
  trackId: z.string().trim().max(64).optional(),
  query: z.string().trim().max(200).optional(),
});

const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;

interface SearchResp {
  tracks?: {
    items?: { id?: string; name?: string; artists?: { name?: string }[] }[];
  };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();

  const parsed = await readJsonBody<unknown>(req, 2 * 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);
  if (!v.data.trackId && !v.data.query) {
    return json({ error: "need trackId or query" }, 400);
  }

  const conn = await getActiveSpotifyConnection(userId);
  if (!conn) return json({ error: "spotify not connected" }, 400);

  // user-library-modify must be in the granted scope set. If the user
  // connected before R28i added this scope, they need to disconnect
  // + reconnect to upgrade. Surfaced specifically so the UI can hint.
  if (!conn.scope.includes("user-library-modify")) {
    return json(
      {
        error:
          "스코프 부족 — Spotify 연결을 해제하고 다시 연결하면 권한이 갱신됩니다.",
      },
      403,
    );
  }

  // Resolve the Spotify track id.
  let trackId = v.data.trackId ?? null;
  if (!trackId || !SPOTIFY_ID_RE.test(trackId)) {
    try {
      const searchUrl = `/search?type=track&limit=1&q=${encodeURIComponent(v.data.query ?? "")}`;
      const searchResp = await spotifyFetch<SearchResp>(conn.accessToken, searchUrl);
      const hit = searchResp.tracks?.items?.[0];
      if (!hit?.id || !SPOTIFY_ID_RE.test(hit.id)) {
        return json({ error: "no match on Spotify" }, 404);
      }
      trackId = hit.id;
    } catch (e) {
      const status = (e as { status?: number })?.status;
      if (status === 401) return json({ error: "spotify auth expired" }, 401);
      return json({ error: "Spotify search failed" }, 502);
    }
  }

  // PUT /v1/me/tracks?ids=<id> idempotently adds to Liked Songs.
  // Spotify returns 200 with empty body on success.
  try {
    await spotifyFetch(conn.accessToken, `/me/tracks?ids=${trackId}`, {
      method: "PUT",
    });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401) return json({ error: "spotify auth expired" }, 401);
    if (status === 403) {
      return json(
        { error: "Spotify rejected — re-connect to refresh scope grants." },
        403,
      );
    }
    return json({ error: "Spotify like failed" }, 502);
  }

  return json({ ok: true, trackId }, 200);
}
