import { z } from "zod";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { isAdminEmail } from "@/lib/constants";

/**
 * POST /api/admin/genre-requests/[id]/decide
 *
 * Admin-only. Marks a pending genre_request as accepted / rejected /
 * duplicate, records the operator's user_id + timestamp, and (for
 * accepted 'catalog' kind only) inserts a blank row into genre_info
 * so the lazy-warm path on /genre/[name] fills in the description
 * on first visit. 'reanalysis' acceptance is operator-action only —
 * we just flip the status; the actual rerun happens out-of-band via
 * services/analysis tooling.
 */
const Body = z.object({
  decision: z.enum(["accepted", "rejected", "duplicate"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return json({ error: "forbidden" }, 403);
  }
  const { userId: adminId } = await ensureConnection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad id" }, 400);

  const parsed = await readJsonBody<unknown>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data);
  if (!v.success) return json({ error: "invalid payload" }, 400);
  const { decision } = v.data;

  const sql = getSql();
  // Snapshot the request row so we know what to do with it after the
  // status update. SELECT FOR UPDATE would be cleaner but neon's HTTP
  // driver doesn't run transactions — we accept a tiny race window
  // here (admin double-clicks decide twice in the same second).
  const rows = await sql`
    SELECT kind, subject, status FROM genre_requests
    WHERE id = ${id}::uuid LIMIT 1`;
  if (rows.length === 0) return json({ error: "not found" }, 404);
  const r = rows[0]!;
  if (r.status !== "pending") {
    return json({ error: `already ${r.status}` }, 409);
  }

  await sql`
    UPDATE genre_requests
    SET status = ${decision},
        decided_at = now(),
        decided_by = ${adminId}
    WHERE id = ${id}::uuid`;

  // 'catalog' accept side-effect: ensure a genre_info row exists with
  // NULL descriptions so the next /genre/[name] visit warms it via
  // the existing lazy path. We don't burn a Gemini call here — that
  // happens in the request that actually displays the genre.
  let createdGenreInfo = false;
  if (decision === "accepted" && r.kind === "catalog") {
    try {
      await sql`
        INSERT INTO genre_info (genre, description_en, description_ko)
        VALUES (${(r.subject as string).toLowerCase().trim()}, NULL, NULL)
        ON CONFLICT (genre) DO NOTHING`;
      createdGenreInfo = true;
    } catch (e) {
      console.error("[genre-request] genre_info insert failed:", e);
      // Decision still recorded — operator can manually insert.
    }
  }

  return json({ ok: true, decision, createdGenreInfo }, 200);
}
