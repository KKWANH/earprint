import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { getJson, json } from "@/lib/http";

const LASTFM = "https://ws.audioscrobbler.com/2.0/";

/**
 * Adds an artist discovered on the map to the user's library — pulls the
 * artist's top tracks (Last.fm) and inserts them as liked tracks. These likes
 * survive a later YouTube re-sync (source = 'discover').
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = (await ensureConnection()).userId;
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { artist?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const artist = (body.artist ?? "").trim();
  if (!artist) return json({ error: "artist required" }, 400);

  const key = process.env.LASTFM_API_KEY;
  if (!key) return json({ ok: false, reason: "lastfm_unconfigured" }, 200);

  let tracks: { artist: string; title: string }[] = [];
  try {
    const data = await getJson(
      `${LASTFM}?method=artist.gettoptracks&autocorrect=1&format=json&limit=4` +
        `&artist=${encodeURIComponent(artist)}&api_key=${key}`,
    );
    let t = data?.toptracks?.track;
    if (t) {
      if (!Array.isArray(t)) t = [t];
      tracks = t
        .map((x: { name?: unknown }) => ({ artist, title: String(x?.name ?? "").trim() }))
        .filter((x: { title: string }) => x.title);
    }
  } catch {
    /* fall through */
  }
  if (tracks.length === 0) return json({ ok: false, reason: "no_tracks" }, 200);

  const sql = getSql();
  const rows = await sql`
    SELECT add_liked_tracks(${userId}, ${JSON.stringify(tracks)}::jsonb) AS n`;
  return json({ ok: true, added: rows[0].n as number, artist }, 200);
}
