/**
 * Spotify Web API client + OAuth helpers.
 *
 * Account model: Spotify is an *additional* source on top of a user's
 * existing Google sign-in (auth.js / NextAuth handles the primary
 * identity). The Spotify access + refresh tokens live in their own
 * table (spotify_connections); we never put Spotify into the NextAuth
 * providers list because that would mean account-linking logic for
 * the dual-provider case, which we don't want yet.
 *
 * Scopes requested up front so the consent screen only shows once:
 *   - user-library-read         (/me/tracks — Liked Songs, the v0 endpoint)
 *   - playlist-read-private     (/me/playlists, /playlists/:id/tracks)
 *   - user-top-read             (/me/top/{tracks,artists})
 *   - user-read-recently-played (/me/player/recently-played)
 *
 * Token lifecycle: access tokens last ~1h. We refresh on-demand inside
 * spotifyFetch() when the stored token is within 60s of expiry, then
 * write the new (access_token, expires_at) back to the row. The
 * refresh_token is reused — Spotify only rotates it if you supply the
 * `client_credentials` grant.
 */
import { getSql } from "./db";

export const SPOTIFY_AUTHORIZE = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "user-library-read",
  "playlist-read-private",
  "user-top-read",
  "user-read-recently-played",
  // user-read-email (R28h): lets /me return the user's Spotify-side
  // email. Two reasons we want it:
  //   1. Diagnostics for the Dev Mode 403 case — server logs show
  //      which account is actually signing in so we can verify the
  //      user list matches.
  //   2. Future "auto-link by email" — when the user's Spotify email
  //      equals their Google email, we can skip the explicit
  //      "Connect" step on next sign-in.
  // Doesn't grant write access to anything; safe to request.
  "user-read-email",
  // user-library-modify (R28i): write scope, lets us hit
  // PUT /v1/me/tracks?ids=... to actually heart a track in the
  // user's Spotify library. Powers the "♥ Save to Spotify" button
  // on community worldcup champions (one-tap from a champion view).
  "user-library-modify",
].join(" ");

export interface SpotifyConnection {
  userId: string;
  spotifyUserId: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  expiresAt: Date;
  connectedAt: Date;
  lastSyncedAt: Date | null;
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

/** Builds the canonical redirect URI for one of the registered origins.
 *  Read from AUTH_URL (set in wrangler vars) so prod / preview / local
 *  all stay in sync without environment-specific code paths. */
export function spotifyRedirectUri(): string {
  const base = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api/auth/spotify/callback`;
}

/** Exchanges an authorization code for an access + refresh token pair.
 *  Caller's responsibility to enforce the state-cookie roundtrip — this
 *  function only handles the network step.
 */
export async function exchangeSpotifyCode(
  code: string,
): Promise<SpotifyTokenResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("spotify credentials missing");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: spotifyRedirectUri(),
  });
  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`spotify token exchange ${res.status}: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as SpotifyTokenResponse;
}

/** Refreshes an access token using the stored refresh_token. The
 *  refresh_token usually isn't returned again; we keep the old one in
 *  that case (per Spotify spec). */
async function refreshSpotifyToken(
  refreshToken: string,
): Promise<SpotifyTokenResponse> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("spotify credentials missing");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(SPOTIFY_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`spotify refresh ${res.status}: ${txt.slice(0, 200)}`);
  }
  return (await res.json()) as SpotifyTokenResponse;
}

/** Loads the user's Spotify connection row, refreshing the access
 *  token in-place if it's within 60s of expiry. Returns null when
 *  the user hasn't connected Spotify yet.
 */
export async function getActiveSpotifyConnection(
  userId: string,
): Promise<SpotifyConnection | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id::text AS "userId", spotify_user_id AS "spotifyUserId",
           access_token AS "accessToken", refresh_token AS "refreshToken",
           scope, expires_at AS "expiresAt",
           connected_at AS "connectedAt", last_synced_at AS "lastSyncedAt"
    FROM spotify_connections
    WHERE user_id = ${userId}::uuid
    LIMIT 1`;
  if (rows.length === 0) return null;
  const r = rows[0]!;
  const conn: SpotifyConnection = {
    userId: r.userId as string,
    spotifyUserId: r.spotifyUserId as string,
    accessToken: r.accessToken as string,
    refreshToken: r.refreshToken as string,
    scope: r.scope as string,
    expiresAt: new Date(r.expiresAt as string),
    connectedAt: new Date(r.connectedAt as string),
    lastSyncedAt: r.lastSyncedAt ? new Date(r.lastSyncedAt as string) : null,
  };
  // Refresh if access token expires within 60s. 60s buffer covers
  // network latency on the API call we're about to make.
  const expiringSoon = conn.expiresAt.getTime() - Date.now() < 60_000;
  if (!expiringSoon) return conn;
  try {
    const fresh = await refreshSpotifyToken(conn.refreshToken);
    const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000);
    const newRefreshToken = fresh.refresh_token ?? conn.refreshToken;
    await sql`
      UPDATE spotify_connections
         SET access_token = ${fresh.access_token},
             refresh_token = ${newRefreshToken},
             expires_at = ${newExpiresAt.toISOString()}::timestamptz
       WHERE user_id = ${userId}::uuid`;
    return {
      ...conn,
      accessToken: fresh.access_token,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    };
  } catch (e) {
    // Refresh failed — most likely the user revoked us at
    // spotify.com/account/apps. Surface as no-connection so the UI
    // re-prompts a Connect button instead of looping on 401s.
    console.error("[spotify] refresh failed:", e);
    return null;
  }
}

/** Fetch helper that auto-attaches the bearer token. Returns parsed
 *  JSON or throws — caller handles 401 (revoked) by deleting the row. */
export async function spotifyFetch<T = unknown>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http") ? path : `${SPOTIFY_API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`spotify ${res.status} ${path}: ${txt.slice(0, 200)}`);
    (err as { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}
