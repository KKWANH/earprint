import { z } from "zod";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json, readJsonBody } from "@/lib/http";
import { getActiveSpotifyConnection, spotifyFetch } from "@/lib/spotify";

/**
 * POST /api/spotify/playlists/[id]/sync
 *
 * Ingests every track in a Spotify playlist into user_tracks with
 * source='spotify-playlist'. Append-only as always — a track removed
 * from the Spotify playlist is NOT removed from user_tracks.
 *
 * Body (optional):
 *   { unsync: true } — remove the playlist from
 *                      spotify_synced_playlists (the import history
 *                      stays in user_tracks). Use when the user
 *                      unticks a playlist in the picker.
 *
 * Otherwise the call inserts/updates the spotify_synced_playlists
 * row + paginates the playlist's tracks. Uses Spotify's snapshot_id
 * to short-circuit when nothing changed since the last sync.
 *
 * Hard cap at 8 pages × 100 = 800 tracks per playlist; re-run to
 * continue. Spotify's playlists.list returns playlist length but our
 * cap covers the long tail.
 */
const Body = z.object({
  unsync: z.boolean().optional(),
});

const PER_PAGE = 100;
const MAX_PAGES = 8;

interface PlaylistTrack {
  id?: string;
  name?: string;
  artists?: { name?: string; id?: string }[];
  album?: { name?: string; release_date?: string };
  duration_ms?: number;
  external_ids?: { isrc?: string };
  is_local?: boolean;
}
interface PlaylistTracksPage {
  items?: { added_at?: string; track?: PlaylistTrack | null }[];
  next?: string | null;
}
interface PlaylistMeta {
  id?: string;
  name?: string;
  snapshot_id?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();

  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return json({ error: "bad id" }, 400);

  const parsed = await readJsonBody<unknown>(req, 1024);
  if (!parsed.ok) return parsed.response;
  const v = Body.safeParse(parsed.data ?? {});
  if (!v.success) return json({ error: "invalid payload" }, 400);

  const sql = getSql();

  // Unsync path: just remove from our state table. The user_tracks
  // rows already imported stay (Earprint history is permanent).
  if (v.data.unsync) {
    try {
      await sql`
        DELETE FROM spotify_synced_playlists
        WHERE user_id = ${userId}::uuid AND playlist_id = ${id}`;
    } catch {
      /* table not migrated — nothing to delete, still success */
    }
    return json({ ok: true, unsynced: true }, 200);
  }

  const conn = await getActiveSpotifyConnection(userId);
  if (!conn) return json({ error: "not connected" }, 400);

  // Snapshot-id check — if Spotify says nothing changed since our
  // last sync, skip the pagination round-trip.
  let meta: PlaylistMeta;
  try {
    meta = await spotifyFetch<PlaylistMeta>(
      conn.accessToken,
      `/playlists/${id}?fields=id,name,snapshot_id`,
    );
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401) return json({ error: "spotify auth expired" }, 401);
    return json({ error: "couldn't load playlist" }, 502);
  }

  let priorSnapshot: string | null = null;
  try {
    const r = await sql`
      SELECT snapshot_id FROM spotify_synced_playlists
      WHERE user_id = ${userId}::uuid AND playlist_id = ${id}`;
    priorSnapshot = r[0]?.snapshot_id as string | null | undefined ?? null;
  } catch {
    /* fall through to a full sync */
  }
  const upToDate = priorSnapshot && meta.snapshot_id && priorSnapshot === meta.snapshot_id;

  if (upToDate) {
    await sql`
      UPDATE spotify_synced_playlists
         SET last_synced_at = now()
       WHERE user_id = ${userId}::uuid AND playlist_id = ${id}`;
    return json({ ok: true, skipped: "snapshot_id matches" }, 200);
  }

  let added = 0;
  let scanned = 0;
  let nextUrl: string | null = `/playlists/${id}/tracks?limit=${PER_PAGE}`;
  let pages = 0;
  try {
    while (nextUrl && pages < MAX_PAGES) {
      const page: PlaylistTracksPage = await spotifyFetch(conn.accessToken, nextUrl);
      const items = page.items ?? [];
      for (const it of items) {
        scanned++;
        const tr = it.track;
        if (!tr || tr.is_local) continue; // local files have no Spotify metadata
        if (!tr.id || !tr.name) continue;
        const artist = tr.artists?.[0]?.name?.trim();
        if (!artist) continue;
        // Inline resolve-or-create (same shape as in /sync). Kept
        // inline rather than extracted because the unique snapshot_id
        // gating already makes the duplicated query cheap.
        let trackId: string | null = null;
        if (tr.external_ids?.isrc) {
          const r = await sql`
            SELECT id::text AS id FROM tracks WHERE isrc = ${tr.external_ids.isrc} LIMIT 1`;
          if (r.length > 0) trackId = r[0]!.id as string;
        }
        if (!trackId) {
          const r = await sql`
            SELECT id::text AS id FROM tracks
            WHERE lower(artist) = ${artist.toLowerCase()}
              AND lower(title) = ${tr.name.toLowerCase()}
            LIMIT 1`;
          if (r.length > 0) trackId = r[0]!.id as string;
        }
        if (!trackId) {
          const r = await sql`
            INSERT INTO tracks (title, artist, album, duration_ms, isrc)
            VALUES (
              ${tr.name}, ${artist},
              ${tr.album?.name ?? null}, ${tr.duration_ms ?? null},
              ${tr.external_ids?.isrc ?? null}
            )
            RETURNING id::text AS id`;
          trackId = r[0]!.id as string;
        }
        await sql`
          INSERT INTO track_sources (track_id, source, source_id, raw_title, raw_artist)
          VALUES (${trackId}::uuid, 'spotify', ${tr.id}, ${tr.name}, ${artist})
          ON CONFLICT (source, source_id) DO NOTHING`;
        const r = await sql`
          INSERT INTO user_tracks (user_id, track_id, source, liked_at)
          VALUES (
            ${userId}::uuid, ${trackId}::uuid, 'spotify-playlist',
            ${it.added_at ?? null}
          )
          ON CONFLICT (user_id, track_id) DO NOTHING
          RETURNING 1`;
        if (r.length > 0) added++;
      }
      nextUrl = page.next ?? null;
      pages++;
    }
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401) return json({ error: "spotify auth expired" }, 401);
    return json({ error: "sync failed", added, scanned }, 500);
  }

  // Upsert state table with the new snapshot_id.
  await sql`
    INSERT INTO spotify_synced_playlists
      (user_id, playlist_id, name, snapshot_id, last_synced_at)
    VALUES (
      ${userId}::uuid, ${id}, ${meta.name ?? null},
      ${meta.snapshot_id ?? null}, now()
    )
    ON CONFLICT (user_id, playlist_id) DO UPDATE
      SET name = EXCLUDED.name,
          snapshot_id = EXCLUDED.snapshot_id,
          last_synced_at = EXCLUDED.last_synced_at`;

  return json(
    {
      ok: true,
      added,
      scanned,
      reachedMaxPages: pages >= MAX_PAGES && nextUrl != null,
    },
    200,
  );
}
