import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { buildCompletionEmail, sendEmail } from "@/lib/email";
import { json } from "@/lib/http";
import { getLibraryStats } from "@/lib/library";

/** Re-sends the taste-summary report email on demand. */
export async function POST() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const sql = getSql();
  const rows = await sql`SELECT email FROM users WHERE id = ${userId}`;
  const email = rows[0]?.email as string | undefined;
  if (!email) return json({ error: "no email on file" }, 400);

  const stats = await getLibraryStats(userId);
  if (stats.total === 0) {
    return json({ ok: false, reason: "no_data" }, 200);
  }

  const { subject, html } = buildCompletionEmail(stats);
  const result = await sendEmail({ to: email, subject, html });
  return json({ ok: result === "sent", reason: result, to: email }, 200);
}
