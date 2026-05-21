import type { NextRequest } from "next/server";
import type { SyncRequest } from "@playlist-analyzer/shared";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";

/**
 * Extension → backend sync of liked songs.
 * Auth: Authorization: Bearer <sync_token> (matched against users.sync_token).
 *
 * The extension service worker's fetch is subject to CORS, so headers are explicit.
 * A Bearer token (not cookies) is used, so Allow-Origin: * is safe.
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
  if (!token) return json({ error: "missing token" }, 401, CORS);

  let body: SyncRequest;
  try {
    body = (await req.json()) as SyncRequest;
  } catch {
    return json({ error: "invalid json" }, 400, CORS);
  }
  if (!Array.isArray(body?.tracks) || body.tracks.length === 0) {
    return json({ error: "no tracks" }, 400, CORS);
  }

  const sql = getSql();
  const users = await sql`SELECT id FROM users WHERE sync_token = ${token}`;
  if (users.length === 0) return json({ error: "invalid token" }, 401, CORS);

  const rows = await sql`
    SELECT * FROM sync_liked_tracks(
      ${users[0].id as string},
      ${JSON.stringify(body.tracks)}::jsonb
    )`;

  return json({ ok: true, ...rows[0] }, 200, CORS);
}
