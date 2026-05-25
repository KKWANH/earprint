import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) configuration.
 * Env vars AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET are read automatically.
 * trustHost: required on non-Vercel hosts (Cloudflare Workers, etc.).
 *
 * Default sign-in only requests openid/email/profile — adding sensitive scopes
 * here (e.g. youtube.readonly) triggers Google's "unverified app" warning for
 * every user. The YouTube scope is requested via a separate incremental
 * OAuth flow (see /api/yt-oauth/*) only when the user explicitly opts into
 * API-mode sync.
 *
 * Phase 1 uses JWT sessions (no DB adapter). On entering /connect,
 * ensureConnection() upserts the user row directly into the users table.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [Google],
});
