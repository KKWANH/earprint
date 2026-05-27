import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) configuration.
 * Env vars AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET are read automatically.
 * trustHost: required on non-Vercel hosts (Cloudflare Workers, etc.).
 *
 * Sign-in only requests openid / email / profile — nothing more.
 *
 * The earlier `youtube.readonly` incremental-scope flow (and the
 * /api/sync-yt path that consumed it) was removed: the YouTube Data
 * API exposes the user's YouTube "Liked Videos" playlist, but YouTube
 * Music's "Liked Music" is a separate list the API doesn't surface —
 * users with 1,400 YT Music likes were getting ~325 results, missing
 * 75%+ of their actual library. The browser extension reads the real
 * Liked Music page in the user's own logged-in tab; that's the only
 * path that ships full coverage, so it's the only path we offer.
 *
 * Phase 1 uses JWT sessions (no DB adapter). On entering /connect,
 * ensureConnection() upserts the user row directly into the users table.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [Google],
});
