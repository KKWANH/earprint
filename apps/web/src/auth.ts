import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) 설정.
 * 환경변수: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET 를 자동으로 읽는다.
 * trustHost: Vercel 이 아닌 호스트(Cloudflare Workers 등)에서 필요.
 *
 * Phase 1: JWT 세션 사용(DB 어댑터 없음). 사용자 행은 /connect 진입 시
 * ensureConnection() 이 users 테이블에 직접 upsert 한다.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [Google],
});
