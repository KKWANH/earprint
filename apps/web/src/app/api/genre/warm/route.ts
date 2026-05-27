import { ensureConnection } from "@/lib/connection";
import { warmGenreDescription } from "@/lib/genreDetail";
import { json, readJsonBody } from "@/lib/http";

/**
 * Lazy-fill the AI description for a genre.
 *
 * The genre detail page (`apps/web/src/app/genre/[name]/page.tsx`) is a
 * Server Component that needs to come back in under Workers' per-request
 * CPU budget. The Gemini description call alone was tipping it over the
 * limit on first visit (Cloudflare Error 1102). This endpoint moves that
 * call into its own request, kicked off by the client after the page is
 * on-screen, so the page render stays cheap.
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const parsed = await readJsonBody<{ name?: string }>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const name = (body.name ?? "").trim();
  if (!name) return json({ error: "name required" }, 400);

  const { descriptionEn, descriptionKo } = await warmGenreDescription(name, userId);
  return json({ descriptionEn, descriptionKo }, 200);
}
