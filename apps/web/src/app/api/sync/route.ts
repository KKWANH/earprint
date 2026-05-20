import type { NextRequest } from "next/server";
import type { SyncRequest } from "@playlist-analyzer/shared";
import { getSql } from "@/lib/db";

/**
 * 확장 → 백엔드 좋아요 동기화 엔드포인트.
 * 인증: Authorization: Bearer <sync_token>  (users.sync_token 과 대조)
 *
 * 확장 service worker 의 fetch 는 CORS 대상이므로 헤더를 명시한다.
 * 쿠키가 아닌 Bearer 토큰을 쓰므로 Allow-Origin: * 가 안전하다.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: "missing token" }, 401);

  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!Array.isArray(body?.tracks) || body.tracks.length === 0) {
    return json({ error: "no tracks" }, 400);
  }

  const sql = getSql();
  const users = await sql`SELECT id FROM users WHERE sync_token = ${token}`;
  if (users.length === 0) return json({ error: "invalid token" }, 401);

  const rows = await sql`
    SELECT * FROM sync_liked_tracks(
      ${users[0].id as string},
      ${JSON.stringify(body.tracks)}::jsonb
    )`;

  return json({ ok: true, ...rows[0] }, 200);
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
