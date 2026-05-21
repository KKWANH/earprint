import { auth } from "@/auth";
import { getJson, json } from "@/lib/http";

/**
 * Deezer preview URL proxy.
 * Deezer preview URLs are signed and expire, so stored copies are not used —
 * a fresh URL is fetched right before playback.
 * Only checks that the caller is signed in (no users-table write needed).
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return json({ error: "unauthorized" }, 401);

  const deezerId = new URL(req.url).searchParams.get("deezerId");
  if (!deezerId || !/^\d+$/.test(deezerId)) {
    return json({ error: "deezerId required" }, 400);
  }

  const data = await getJson(`https://api.deezer.com/track/${deezerId}`);
  const url: string | undefined = data?.preview;
  if (!url) return json({ error: "no preview" }, 404);
  return json({ url }, 200);
}
