import { neon } from "@neondatabase/serverless";

/**
 * Neon Postgres(서버리스) 연결.
 * HTTP 기반이라 Cloudflare Workers 런타임에서 동작한다.
 * 반환값은 태그드 템플릿 쿼리 함수: sql`SELECT ...`
 */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다");
  return neon(url);
}
