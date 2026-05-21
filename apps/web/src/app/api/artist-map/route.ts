import { ensureConnection } from "@/lib/connection";
import { json } from "@/lib/http";
import { getArtistMap } from "@/lib/artistMap";

/** Artist-map dataset — most-liked artists + their genre fingerprints. */
export async function GET() {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
  const data = await getArtistMap(userId);
  return json(data, 200);
}
