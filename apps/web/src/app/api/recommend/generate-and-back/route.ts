import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { generateRecommendations, type RecMode } from "@/lib/recommend";

/**
 * POST /api/recommend/generate-and-back
 *
 * Form-action target for the R33 "auto-pick mode" CTA on /recommend.
 * Reads the chosen mode from form data, generates a batch the same
 * way /api/recommend/generate does, then 302s back to /recommend so
 * the new picks land in the Tournament without the client having to
 * orchestrate a fetch + refresh dance.
 *
 * Native HTML form action keeps the calling surface (the suggestion
 * card) as a pure server component — no client state, no fetch
 * lifecycle.
 */
const MODES = new Set<RecMode>([
  "song",
  "genre",
  "unheard",
  "indie",
  "mix",
  "spotify-top",
]);

function back(): Response {
  const base = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
  return new Response(null, {
    status: 302,
    headers: { Location: `${base}/recommend` },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return back();

  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return back();
  }

  const form = await req.formData().catch(() => null);
  const raw = (form?.get("mode") as string | null) ?? "mix";
  const mode: RecMode = MODES.has(raw as RecMode) ? (raw as RecMode) : "mix";

  const sql = getSql();
  try {
    const rows = await generateRecommendations(userId, mode);
    if (rows.length > 0) {
      await sql`
        SELECT save_recommendations(${userId}, ${JSON.stringify(rows)}::jsonb)`;
    }
  } catch {
    /* swallow — redirect anyway so the user lands somewhere */
  }
  return back();
}
