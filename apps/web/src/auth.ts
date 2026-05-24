import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) configuration.
 * Env vars AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET are read automatically.
 * trustHost: required on non-Vercel hosts (Cloudflare Workers, etc.).
 *
 * Scopes: openid/email/profile (default) + youtube.readonly. The YouTube
 * scope is what enables the API-based liked-songs sync — mobile users who
 * can't run the Chrome extension can hit /api/sync-yt instead. The access
 * token is captured in the JWT on first sign-in and surfaced on the session.
 *
 * Phase 1 uses JWT sessions (no DB adapter). On entering /connect,
 * ensureConnection() upserts the user row directly into the users table.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      authorization: {
        params: {
          // Request offline access + the YouTube readonly scope so the API
          // sync path has what it needs. `prompt=consent` forces Google to
          // re-show the consent screen so existing users grant the new scope.
          access_type: "offline",
          prompt: "consent",
          scope:
            "openid email profile https://www.googleapis.com/auth/youtube.readonly",
        },
      },
    }),
  ],
  callbacks: {
    // Capture the Google access/refresh tokens on first sign-in. Auth.js only
    // exposes `account` on the initial JWT creation — after that, we have to
    // refresh manually when the access token expires.
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt = account.expires_at; // unix seconds
      }
      return token;
    },
    async session({ session, token }) {
      // Surface enough on the session for the YT sync route to function.
      // The access token is sensitive but only readable via server-side
      // `auth()` — it never reaches the client.
      (session as { accessToken?: string }).accessToken =
        token.accessToken as string | undefined;
      (session as { refreshToken?: string }).refreshToken =
        token.refreshToken as string | undefined;
      (session as { accessTokenExpiresAt?: number }).accessTokenExpiresAt =
        token.accessTokenExpiresAt as number | undefined;
      return session;
    },
  },
});
