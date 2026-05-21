import { auth } from "@/auth";
import { getJson, json } from "@/lib/http";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Deezer preview URL proxy.
 * Deezer preview URLs are signed and expire, so a fresh URL is fetched right
 * before playback. Retries — Deezer occasionally rate-limits, and a hard
 * failure here silently breaks playback.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return json({ error: "unauthorized" }, 401);

  const deezerId = new URL(req.url).searchParams.get("deezerId");
  if (!deezerId || !/^\d+$/.test(deezerId)) {
    return json({ error: "deezerId required" }, 400);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const data = await getJson(`https://api.deezer.com/track/${deezerId}`);
      if (typeof data?.preview === "string" && data.preview) {
        return json({ url: data.preview }, 200);
      }
      // Deezer error payload (e.g. quota exceeded) → wait and retry.
      if (data?.error) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      return json({ error: "no preview" }, 404);
    } catch {
      await sleep(500 * (attempt + 1));
    }
  }
  return json({ error: "deezer unavailable" }, 503);
}
