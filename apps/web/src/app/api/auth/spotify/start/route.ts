import { auth } from "@/auth";
import { json } from "@/lib/http";
import {
  SPOTIFY_AUTHORIZE,
  SPOTIFY_SCOPES,
  spotifyRedirectUri,
} from "@/lib/spotify";

/**
 * GET /api/auth/spotify/start
 *
 * Kicks off the Spotify OAuth flow. Generates a random `state` value,
 * stores it in a short-lived HttpOnly cookie, then 302s the user to
 * Spotify's authorize endpoint. The callback handler reads the cookie
 * back to defeat CSRF.
 *
 * Auth-gated: user must already be signed in via Google (account
 * linking model — Spotify is an additional source on top of the
 * existing Google identity).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return json({ error: "spotify not configured on this deploy" }, 503);
  }

  // 16-byte random state. crypto.getRandomValues is available in CF
  // Workers; Buffer.from(...).toString('hex') keeps it URL-safe.
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const qp = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: spotifyRedirectUri(),
    state,
    // show_dialog=false reuses the user's prior consent if the same
    // scope set was already granted — smoother re-connect flow.
    show_dialog: "false",
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${SPOTIFY_AUTHORIZE}?${qp.toString()}`,
      // 5-minute window for the user to complete consent + return.
      // HttpOnly + SameSite=Lax so the cookie survives the cross-site
      // redirect chain (Lax allows cookie on top-level navigation back
      // to our domain, which is the callback shape).
      "Set-Cookie": `spotify_oauth_state=${state}; Path=/; Max-Age=300; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}
