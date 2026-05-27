import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/**
 * Sets a per-artist preference weight — { artist, weight }.
 * weight 2 or 3 is stored; weight 1 (normal) clears any stored rating.
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{ artist?: string; weight?: unknown }>(
    req,
    1024,
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const artist = (body.artist ?? "").trim();
  const weight = Number(body.weight);
  if (!artist || !Number.isFinite(weight) || weight < 1 || weight > 3) {
    return json({ error: "artist and weight 1–3 required" }, 400);
  }

  const sql = getSql();
  if (weight <= 1) {
    await sql`
      DELETE FROM artist_affinity WHERE user_id = ${userId} AND artist = ${artist}`;
  } else {
    await sql`
      INSERT INTO artist_affinity (user_id, artist, weight, updated_at)
      VALUES (${userId}, ${artist}, ${weight}, now())
      ON CONFLICT (user_id, artist)
      DO UPDATE SET weight = ${weight}, updated_at = now()`;
  }
  return json({ ok: true, artist, weight }, 200);
}
