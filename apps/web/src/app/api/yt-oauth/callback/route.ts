import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";

/**
 * Callback for the incremental YouTube OAuth flow. Exchanges the auth code
 * for an access/refresh token pair, stores them on the user row, and
 * redirects back to /connect with a status hash that the page can react to.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // User cancelled the consent screen or Google returned an explicit error.
  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/connect#yt=${error ?? "cancelled"}`, req.url),
    );
  }

  // CSRF check — state in the URL must match the cookie we set in /start.
  const cookieState = req.cookies.get("yt_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL("/connect#yt=bad-state", req.url));
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/connect#yt=not-signed-in", req.url));
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth client not configured" },
      { status: 500 },
    );
  }

  // Exchange the auth code for tokens. The redirect_uri sent here MUST
  // match the one we sent in /start exactly — Google compares by string.
  const origin = process.env.AUTH_URL ?? url.origin;
  const redirectUri = `${origin}/api/yt-oauth/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/connect#yt=exchange-failed", req.url));
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  };

  // Sanity check — the granted scope must include youtube.readonly. Without
  // it, the sync call will fail server-side anyway, so fail loud here.
  if (!tokens.scope?.includes("youtube.readonly")) {
    return NextResponse.redirect(new URL("/connect#yt=no-scope", req.url));
  }

  const { userId } = await ensureConnection();
  const sql = getSql();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  // Persist tokens. `refresh_token` is only sent on first consent — if a user
  // re-runs OAuth (e.g. revoked + reauth) Google omits it, so we coalesce
  // against the existing value.
  await sql`
    UPDATE users
       SET yt_access_token     = ${tokens.access_token},
           yt_refresh_token    = COALESCE(${tokens.refresh_token ?? null}, yt_refresh_token),
           yt_token_expires_at = ${expiresAt.toISOString()},
           updated_at          = now()
     WHERE id = ${userId}`;

  const res = NextResponse.redirect(new URL("/connect#yt=connected", req.url));
  res.cookies.delete("yt_oauth_state");
  return res;
}
