import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { captureError } from "@/lib/sentry";

/**
 * Persists a worldcup champion. Called from Bracket / GenreBracket the
 * moment a tournament finishes so the user can revisit their picks on
 * a history page later.
 *
 * The champion payload is stored verbatim as JSONB so we don't have to
 * keep schemas in sync between song-style and genre-style cards — the
 * UI that reads it back uses the same renderer.
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{
    category?: string;
    size?: number;
    pattern?: string;
    champion?: unknown;
  }>(req, 16 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const category = String(body.category ?? "").trim();
  const size = Number(body.size);
  const pattern = String(body.pattern ?? "random").trim();
  if (!category || !Number.isFinite(size) || !body.champion) {
    return json({ error: "category/size/champion required" }, 400);
  }

  const sql = getSql();
  try {
    const rows = await sql`
      INSERT INTO tournament_results (user_id, category, size, pattern, champion)
      VALUES (${userId}::uuid, ${category}, ${size}::int, ${pattern},
              ${JSON.stringify(body.champion)}::jsonb)
      RETURNING id::text AS id, created_at`;
    return json({ ok: true, id: rows[0]?.id, createdAt: rows[0]?.created_at }, 200);
  } catch (e) {
    captureError(e, { tag: "worldcup.save-champion" });
    return json({ ok: false, error: String(e) }, 500);
  }
}
