import { z } from "zod";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/**
 * POST /api/worldcup/community/[id]/finish
 *
 * Called by the worldcup player when a bracket reaches a champion.
 * Updates aggregate counters so stats build up over plays. Body shape:
 *   {
 *     championItemId: uuid,           — the single winner
 *     winnerItemIds:  uuid[],         — every item that won at least
 *                                       one match (champion is included)
 *     allItemIds:     uuid[],         — every item that participated
 *                                       (= original bracket positions)
 *   }
 *
 * The client computes these from its bracket state because the server
 * doesn't keep a session — UGC brackets are meant to be playable
 * anonymously (no sign-in required for the play side) and would
 * otherwise need session storage we don't want to take on.
 *
 * Anti-abuse: a play increments play_count on the worldcup once per
 * call. We don't rate-limit yet — a determined attacker could spam
 * the endpoint to inflate counts. Acceptable for MVP; add IP rate-
 * limit in a follow-up if/when this becomes an actual abuse vector.
 */
const Body = z.object({
  championItemId: z.string().uuid(),
  winnerItemIds: z.array(z.string().uuid()).min(1).max(64),
  allItemIds: z.array(z.string().uuid()).min(4).max(32),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad id" }, 400);

  const parsed = await readJsonBody<unknown>(req, 8 * 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);
  const body = v.data;

  // Items must belong to this worldcup. SQL-side check via the
  // worldcup_id filter; we just need to confirm the ids overlap.
  const sql = getSql();

  // appearance += 1 for every item that participated in the bracket
  // (rendered on screen at least once).
  await sql`
    UPDATE community_worldcup_items
       SET appearance_count = appearance_count + 1
     WHERE worldcup_id = ${id}
       AND id = ANY(${body.allItemIds}::uuid[])`;

  // win += 1 for items that won at least one pair. The client sends
  // the full set including the champion.
  await sql`
    UPDATE community_worldcup_items
       SET win_count = win_count + 1
     WHERE worldcup_id = ${id}
       AND id = ANY(${body.winnerItemIds}::uuid[])`;

  // champion += 1 — single row per finish.
  await sql`
    UPDATE community_worldcup_items
       SET champion_count = champion_count + 1
     WHERE worldcup_id = ${id}
       AND id = ${body.championItemId}`;

  // Bump worldcup play counter.
  await sql`
    UPDATE community_worldcups
       SET play_count = play_count + 1
     WHERE id = ${id}`;

  return json({ ok: true }, 200);
}
