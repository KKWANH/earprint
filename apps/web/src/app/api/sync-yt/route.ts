import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
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
 * Token storage: the YouTube scope is granted via the incremental flow at
 * /api/yt-oauth/*, which persists access + refresh tokens on the users row.
 * This route only runs after that opt-in has happened.
 */
/**
 * One chunk per call so Cloudflare Workers' 50-subrequest cap is never hit
 * on big libraries. The client (ApiSyncButton) loops while `nextAfter` is
 * non-null. Body: `{ after?: string }` — opaque YouTube pageToken.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return json({ error: "not signed in" }, 401);
  // Body is optional — { after?: pageToken }. Tiny payload, hard cap 1 KB.
  const parsed = await readJsonBody<{ after?: string }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const pageToken =
    typeof parsed.data?.after === "string" ? parsed.data.after : undefined;

  const { userId } = await ensureConnection();
  const sql = getSql();
  const rows = await sql`
    SELECT yt_access_token, yt_refresh_token, yt_token_expires_at
    FROM users WHERE id = ${userId}`;
  const u = rows[0] as
    | {
        yt_access_token: string | null;
        yt_refresh_token: string | null;
        yt_token_expires_at: string | null;
      }
    | undefined;

  if (!u?.yt_access_token) {
    // Tell the client to send the user through the OAuth flow.
    return json({ error: "yt-not-connected", needsAuth: true }, 403);
  }

  // Refresh the access token if it expires within the next minute. Google
  // access tokens live for ~1 hour.
  let token = u.yt_access_token;
  const expiresAt = u.yt_token_expires_at
    ? new Date(u.yt_token_expires_at).getTime() / 1000
    : 0;
  if (u.yt_refresh_token && expiresAt - 60 < Date.now() / 1000) {
    try {
      const refreshed = await refreshGoogleAccessToken(u.yt_refresh_token);
      token = refreshed.accessToken;
      await sql`
        UPDATE users
           SET yt_access_token     = ${refreshed.accessToken},
               yt_token_expires_at = ${new Date(refreshed.expiresAt * 1000).toISOString()},
               updated_at          = now()
         WHERE id = ${userId}`;
    } catch {
      return json(
        { error: "yt-refresh-failed", needsAuth: true },
        401,
      );
    }
  }

  let result: Awaited<ReturnType<typeof fetchLikedVideos>>;
  try {
    result = await fetchLikedVideos(token, { pageToken });
  } catch (e) {
    if (e instanceof YouTubeApiError) {
      if (e.status === 401) {
        return json({ error: "yt-token-rejected", needsAuth: true }, 401);
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
        // rawCount / skippedCount let the UI explain "0 music in this
        // batch of 250 liked videos" with concrete reasons instead of
        // a blank "0 captured — try again".
        rawCount: result.rawCount,
        skippedCount: result.skippedCount,
        skippedSamples: result.skippedSamples,
        expected: result.total,
        nextAfter: result.nextPageToken,
        note: "empty",
      },
      200,
    );
  }

  // sync_liked_tracks is append-only by design (see db/schema.sql);
  // /api/sync-yt is intrinsically partial (paged + LL isn't a superset
  // of LM) so the append-only default fits naturally here too.
  const procRows = await sql`
    SELECT * FROM sync_liked_tracks(
      ${userId}::uuid,
      ${JSON.stringify(tracks)}::jsonb
    )`;

  return json(
    {
      ok: true,
      captured: tracks.length,
      rawCount: result.rawCount,
      skippedCount: result.skippedCount,
      skippedSamples: result.skippedSamples,
      expected: result.total,
      nextAfter: result.nextPageToken,
      ...procRows[0],
    },
    200,
  );
}
