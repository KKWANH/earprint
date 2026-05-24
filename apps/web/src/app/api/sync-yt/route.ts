import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import {
  fetchLikedVideos,
  refreshGoogleAccessToken,
  toCapturedTracks,
  YouTubeApiError,
} from "@/lib/youtubeApi";

/**
 * Sub-method sync: pulls the user's YouTube Liked Videos via the official
 * Data API. Used by mobile (where the Chrome extension can't run) and as a
 * fallback when the extension flow isn't available.
 *
 * Coverage is partial — see lib/youtubeApi.ts for the caveat. The extension
 * remains the primary path for full YT Music coverage.
 *
 * Auth: NextAuth session (cookie-based). The Google access token is captured
 * on sign-in via the auth callbacks and surfaced on the session.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) return json({ error: "not signed in" }, 401);

  const accessToken = (session as { accessToken?: string }).accessToken;
  const refreshToken = (session as { refreshToken?: string }).refreshToken;
  const expiresAt = (session as { accessTokenExpiresAt?: number }).accessTokenExpiresAt;

  if (!accessToken) {
    return json(
      {
        error:
          "missing YouTube scope on this session — sign out and sign back in",
      },
      403,
    );
  }

  // Refresh the access token if it's already expired (or about to expire in
  // the next minute). Google access tokens last 1 hour.
  let token = accessToken;
  if (refreshToken && expiresAt && expiresAt - 60 < Date.now() / 1000) {
    try {
      token = (await refreshGoogleAccessToken(refreshToken)).accessToken;
    } catch {
      return json(
        { error: "Google session expired — please sign in again" },
        401,
      );
    }
  }

  let result: Awaited<ReturnType<typeof fetchLikedVideos>>;
  try {
    result = await fetchLikedVideos(token);
  } catch (e) {
    if (e instanceof YouTubeApiError) {
      // 401 from YouTube => token bad (probably scope missing). Tell the user
      // to re-auth.
      if (e.status === 401) {
        return json(
          { error: "YouTube authorization expired — sign in again" },
          401,
        );
      }
      return json({ error: e.message }, 502);
    }
    return json({ error: String(e) }, 500);
  }

  const tracks = toCapturedTracks(result.items);
  if (tracks.length === 0) {
    return json(
      {
        ok: true,
        captured: 0,
        expected: result.total,
        note:
          "Your YouTube Liked Videos playlist is empty (or you've only liked YT Music tracks that don't appear in YouTube). Use the Chrome extension on desktop for full coverage.",
      },
      200,
    );
  }

  const { userId } = await ensureConnection();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM sync_liked_tracks(
      ${userId},
      ${JSON.stringify(tracks)}::jsonb
    )`;

  return json(
    {
      ok: true,
      captured: tracks.length,
      expected: result.total,
      ...rows[0],
    },
    200,
  );
}
