import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";

/** Saves the listener's birth year — drives the reminiscence-bump analysis. */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{ year?: unknown }>(req, 256);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const year = Number(body.year);
  const now = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1920 || year > now - 5) {
    return json({ error: "invalid year" }, 400);
  }

  const sql = getSql();
  await sql`UPDATE users SET birth_year = ${year}, updated_at = now() WHERE id = ${userId}`;
  return json({ ok: true, birthYear: year }, 200);
}
