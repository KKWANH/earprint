import type { NextRequest } from "next/server";
import type { SyncRequest } from "@playlist-analyzer/shared";
import { FREE_LIMITS, PAYMENTS_ENABLED } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { isPro } from "@/lib/plan";

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
  const userId = users[0].id as string;

  // Free-tier library-size gate. Pro / payments-off bypass; otherwise we
  // accept the first N tracks and tell the client how many were dropped so
  // the extension can show an upgrade prompt.
  let tracks = body.tracks;
  let dropped = 0;
  if (PAYMENTS_ENABLED && !(await isPro(userId))) {
    const cap = FREE_LIMITS.librarySize;
    if (tracks.length > cap) {
      dropped = tracks.length - cap;
      tracks = tracks.slice(0, cap);
    }
  }

  const rows = await sql`
    SELECT * FROM sync_liked_tracks(
      ${userId},
      ${JSON.stringify(tracks)}::jsonb
    )`;

  return json(
    { ok: true, ...rows[0], plan_dropped: dropped, plan_cap: FREE_LIMITS.librarySize },
    200,
    CORS,
  );
}
