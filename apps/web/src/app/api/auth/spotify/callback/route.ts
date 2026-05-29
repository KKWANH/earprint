import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import {
  exchangeSpotifyCode,
  spotifyFetch,
} from "@/lib/spotify";

/**
 * GET /api/auth/spotify/callback?code=...&state=...
 *
 * The user has just consented at Spotify. We:
 *   1. Verify the `state` value matches the cookie we set in /start
 *      (CSRF defence).
 *   2. Exchange the auth `code` for an access + refresh token pair.
 *   3. Hit /me to grab the Spotify user id (useful for debugging
 *      — "did the user link the wrong account?").
 *   4. Upsert into spotify_connections keyed by our user_id; an
 *      existing row gets replaced (= reconnect with a different
 *      Spotify account).
 *   5. Redirect back to /library with ?spotify=connected so the page
 *      can render a success toast.
 *
 * Failure modes redirect back with ?spotify=error&reason=...; we
 * don't expose the underlying error message to keep the URL clean
 * and avoid leaking provider internals.
 */
function redirectBack(reason?: string): Response {
  const base = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
  const qp = new URLSearchParams();
  qp.set("spotify", reason ? "error" : "connected");
  if (reason) qp.set("reason", reason);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${base}/library?${qp.toString()}`,
      // Always clear the state cookie when we leave the callback —
      // success or failure. Prevents replay if the URL is shared.
      "Set-Cookie": `spotify_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return redirectBack("not-signed-in");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError) return redirectBack(`spotify-${oauthError}`);
  if (!code || !state) return redirectBack("missing-params");

  // Cookie verification — the value Spotify echoed back must equal
  // the one we set in /start. Header parsing is manual; Next 15
  // doesn't expose a cookies() helper inside Route Handlers in CF
  // runtime in a way that matches our test setup.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const stateCookie = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("spotify_oauth_state="))
    ?.slice("spotify_oauth_state=".length);
  if (!stateCookie || stateCookie !== state) return redirectBack("bad-state");

  // Bind to our internal user_id.
  const { userId } = await ensureConnection();

  // Exchange + identify.
  let tokenResp;
  try {
    tokenResp = await exchangeSpotifyCode(code);
  } catch (e) {
    console.error("[spotify-callback] token exchange failed:", e);
    return redirectBack("token-exchange");
  }
  // Log scope grant so the operator can verify the consent screen actually
  // returned what we requested. A user revoking individual scopes mid-
  // consent ends up with a token that 403s on later endpoints; this
  // helps narrow down whether scope mismatch is the cause.
  console.log(
    `[spotify-callback] token exchange ok. scope=${tokenResp.scope ?? "(missing)"}`,
  );
  let meResp: { id?: string; email?: string; display_name?: string };
  try {
    meResp = await spotifyFetch<{
      id?: string;
      email?: string;
      display_name?: string;
    }>(tokenResp.access_token, "/me");
    console.log(
      `[spotify-callback] /me ok: id=${meResp.id ?? "?"} name=${meResp.display_name ?? "?"} email=${meResp.email ?? "(scope withheld)"}`,
    );
  } catch (e) {
    // Surface the actual Spotify response — most often this is a 403
    // because the app is still in Development Mode and the signing-in
    // Spotify account isn't on the app's User list. The redirect
    // reason gets propagated to the UI; full detail goes to logs.
    const status = (e as { status?: number })?.status;
    const msg = String((e as { message?: string })?.message ?? e);
    console.error(
      `[spotify-callback] /me failed status=${status} msg=${msg.slice(0, 400)}`,
    );
    // Tag the specific status so the UI can show a useful hint:
    //   403 → either Dev Mode user-list OR the "owner must have
    //         Premium" check Spotify rolled out in late 2024.
    //         Distinguish on the message body so we can hint right.
    //   401 → token exchange returned bogus token (rare;
    //         client_secret typo)
    //   else → generic
    if (status === 403) {
      const premiumRequired = /premium subscription required/i.test(msg);
      return redirectBack(
        premiumRequired ? "identify-403-premium" : "identify-403-dev-mode",
      );
    }
    if (status === 401) return redirectBack("identify-401-token");
    return redirectBack("identify");
  }
  const spotifyUserId = meResp.id ?? "";
  if (!spotifyUserId) {
    console.error(
      `[spotify-callback] /me returned no id; payload=${JSON.stringify(meResp).slice(0, 300)}`,
    );
    return redirectBack("identify-no-id");
  }

  const expiresAt = new Date(Date.now() + tokenResp.expires_in * 1000);
  // refresh_token usually present on first exchange. Spotify guarantees
  // it on authorization_code flow.
  const refreshToken = tokenResp.refresh_token ?? "";
  if (!refreshToken) return redirectBack("no-refresh-token");

  // Upsert. ON CONFLICT (user_id) DO UPDATE replaces every field —
  // intentional, supports the "disconnect + reconnect with another
  // Spotify account" path without an explicit delete step.
  const sql = getSql();
  await sql`
    INSERT INTO spotify_connections
      (user_id, spotify_user_id, access_token, refresh_token, scope, expires_at)
    VALUES (
      ${userId}::uuid, ${spotifyUserId},
      ${tokenResp.access_token}, ${refreshToken}, ${tokenResp.scope},
      ${expiresAt.toISOString()}::timestamptz
    )
    ON CONFLICT (user_id) DO UPDATE
      SET spotify_user_id = EXCLUDED.spotify_user_id,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          scope = EXCLUDED.scope,
          expires_at = EXCLUDED.expires_at,
          connected_at = now()`;

  return redirectBack();
}
