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
    bracketPath?: unknown;
  }>(req, 64 * 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const category = String(body.category ?? "").trim();
  const size = Number(body.size);
  const pattern = String(body.pattern ?? "random").trim();
  if (!category || !Number.isFinite(size) || !body.champion) {
    return json({ error: "category/size/champion required" }, 400);
  }

  // bracketPath optional: caller may omit (e.g. older clients), or
  // pass an array of pair outcomes. We accept any JSON-serialisable
  // value and store as JSONB; downstream replay page interprets the
  // shape and ignores rows that don't match.
  const bracketPathJson = body.bracketPath
    ? JSON.stringify(body.bracketPath)
    : null;

  const sql = getSql();
  try {
    // Try with bracket_path first. If the column doesn't exist yet
    // (operator hasn't run the migration), fall back to the old
    // INSERT without it. Champion save still succeeds; replay page
    // will just have nothing to render for this row.
    let rows;
    try {
      rows = await sql`
        INSERT INTO tournament_results (user_id, category, size, pattern, champion, bracket_path)
        VALUES (${userId}::uuid, ${category}, ${size}::int, ${pattern},
                ${JSON.stringify(body.champion)}::jsonb,
                ${bracketPathJson}::jsonb)
        RETURNING id::text AS id, created_at`;
    } catch {
      rows = await sql`
        INSERT INTO tournament_results (user_id, category, size, pattern, champion)
        VALUES (${userId}::uuid, ${category}, ${size}::int, ${pattern},
                ${JSON.stringify(body.champion)}::jsonb)
        RETURNING id::text AS id, created_at`;
    }
    return json({ ok: true, id: rows[0]?.id, createdAt: rows[0]?.created_at }, 200);
  } catch (e) {
    captureError(e, { tag: "worldcup.save-champion" });
    return json({ ok: false, error: String(e) }, 500);
  }
}
