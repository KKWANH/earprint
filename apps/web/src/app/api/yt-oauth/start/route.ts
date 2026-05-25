import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Incremental OAuth — kicks off a Google authorisation request *only* for
 * the YouTube Data API scope. Keeps the sensitive scope out of the default
 * sign-in (which would trigger the "unverified app" warning for every
 * visitor) and limits the friction to users who explicitly opt into the
 * API-based sync path.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    // Not signed into Earprint at all — bounce them to the home page.
    return NextResponse.redirect(new URL("/", req.url));
  }

  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "AUTH_GOOGLE_ID not configured" },
      { status: 500 },
    );
  }

  // CSRF protection — random state in a short-lived httpOnly cookie that the
  // callback compares against the `state` URL param.
  const state = randomBytes(16).toString("hex");
  // Google checks the registered redirect_uri string-for-string. Prefer
  // AUTH_URL (set on Cloudflare) so the value is stable regardless of how
  // the request URL reaches the worker.
  const origin = process.env.AUTH_URL ?? new URL(req.url).origin;
  const redirectUri = `${origin}/api/yt-oauth/callback`;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/youtube.readonly",
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("include_granted_scopes", "true");
  // Hint the chosen Google account so the user doesn't have to pick again.
  if (session.user.email) {
    authUrl.searchParams.set("login_hint", session.user.email);
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("yt_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
