import { getSql } from "./db";
import { SPOTIFY_ENABLED } from "./constants";
import { getActiveSpotifyConnection, spotifyFetch } from "./spotify";

/**
 * Weekly auto-sync (R29c) — driven by the existing cron tick. For
 * users whose `spotify_connections.last_synced_at` is older than the
 * staleness window (default 7 days), runs a LIGHT sync that just
 * pulls the most recent /me/tracks page (50 items) and inserts any
 * we haven't already captured.
 *
 * Deliberately narrower than the full sync the UI button fires:
 *   - Only /me/tracks (not top tracks, recently-played, playlists)
 *   - Only the FIRST page (50 items)
 *   - Capped at N users per tick to avoid CF subrequest pressure
 *
 * The point is to keep returning Spotify users' libraries up-to-date
 * with their recent likes without needing them to remember to click
 * "Sync now". Heavy syncs (full /me/tracks + top + recent + playlists
 * + auto-resync of opted-in playlists) stay manual to keep cost
 * predictable.
 *
 * Returns a summary the cron handler can include in its response.
 */

const STALE_DAYS = 7;
const MAX_USERS_PER_TICK = 3;

interface SpotifyTrack {
  id?: string;
  name?: string;
  artists?: { name?: string }[];
  album?: { name?: string };
  duration_ms?: number;
  external_ids?: { isrc?: string };
}
interface SpotifyTracksPage {
  items?: { added_at?: string; track?: SpotifyTrack | null }[];
}

export interface SpotifyCronSummary {
  candidates: number;
  processed: number;
  totalAdded: number;
  errors: { userId: string; reason: string }[];
}

export async function runSpotifySyncIfDue(): Promise<SpotifyCronSummary | null> {
  // R31a — kill-switch off → cron skips. Returns null so the tick
  // response shows `spotify: null` rather than a misleading empty
  // summary that looks like "0 candidates, all good".
  if (!SPOTIFY_ENABLED) return null;
  const sql = getSql();
  let due;
  try {
    due = await sql`
      SELECT user_id::text AS user_id
      FROM spotify_connections
      WHERE last_synced_at IS NULL
         OR last_synced_at < now() - (${STALE_DAYS} || ' days')::interval
      ORDER BY last_synced_at NULLS FIRST
      LIMIT ${MAX_USERS_PER_TICK}`;
  } catch {
    // spotify_connections table not yet migrated — cron exits cleanly.
    return null;
  }

  const summary: SpotifyCronSummary = {
    candidates: due.length,
    processed: 0,
    totalAdded: 0,
    errors: [],
  };

  for (const r of due) {
    const userId = r.user_id as string;
    try {
      const conn = await getActiveSpotifyConnection(userId);
      if (!conn) {
        // Refresh failed (user revoked us). Wipe the row so the
        // cron stops trying — they'll reconnect manually when they
        // want sync back.
        await sql`
          DELETE FROM spotify_connections
          WHERE user_id = ${userId}::uuid`;
        summary.errors.push({ userId, reason: "revoked-cleared" });
        continue;
      }

      // Pull the dedup set first so we can short-circuit on
      // already-imported ids.
      const existing = await sql`
        SELECT ts.source_id
        FROM user_tracks ut
        JOIN track_sources ts ON ts.track_id = ut.track_id
        WHERE ut.user_id = ${userId}::uuid AND ts.source = 'spotify'`;
      const seen = new Set(existing.map((row) => row.source_id as string));

      const page: SpotifyTracksPage = await spotifyFetch(
        conn.accessToken,
        "/me/tracks?limit=50",
      );
      let added = 0;
      for (const it of page.items ?? []) {
        const tr = it.track;
        if (!tr?.id || !tr.name || seen.has(tr.id)) continue;
        const artist = tr.artists?.[0]?.name?.trim();
        if (!artist) continue;
        // Same 3-tier dedup as the regular sync (R28e). Inline here
        // because pulling the helper out into a shared lib would
        // create an awkward dependency chain across route files.
        let trackId: string | null = null;
        if (tr.external_ids?.isrc) {
          const r2 = await sql`
            SELECT id::text AS id FROM tracks WHERE isrc = ${tr.external_ids.isrc} LIMIT 1`;
          if (r2.length > 0) trackId = r2[0]!.id as string;
        }
        if (!trackId) {
          const r2 = await sql`
            SELECT id::text AS id FROM tracks
            WHERE canon_key = track_canon_key(${artist}, ${tr.name})
            LIMIT 1`;
          if (r2.length > 0) trackId = r2[0]!.id as string;
        }
        if (!trackId) {
          const r2 = await sql`
            SELECT id::text AS id FROM tracks
            WHERE lower(artist) = ${artist.toLowerCase()}
              AND lower(title) = ${tr.name.toLowerCase()}
            LIMIT 1`;
          if (r2.length > 0) trackId = r2[0]!.id as string;
        }
        if (!trackId) {
          const r2 = await sql`
            INSERT INTO tracks (title, artist, album, duration_ms, isrc)
            VALUES (
              ${tr.name}, ${artist},
              ${tr.album?.name ?? null}, ${tr.duration_ms ?? null},
              ${tr.external_ids?.isrc ?? null}
            )
            RETURNING id::text AS id`;
          trackId = r2[0]!.id as string;
        }
        await sql`
          INSERT INTO track_sources (track_id, source, source_id, raw_title, raw_artist)
          VALUES (${trackId}::uuid, 'spotify', ${tr.id}, ${tr.name}, ${artist})
          ON CONFLICT (source, source_id) DO NOTHING`;
        const ins = await sql`
          INSERT INTO user_tracks (user_id, track_id, source, liked_at)
          VALUES (
            ${userId}::uuid, ${trackId}::uuid, 'spotify',
            ${it.added_at ?? null}
          )
          ON CONFLICT (user_id, track_id) DO NOTHING
          RETURNING 1`;
        if (ins.length > 0) added++;
        seen.add(tr.id);
      }

      await sql`
        UPDATE spotify_connections
           SET last_synced_at = now()
         WHERE user_id = ${userId}::uuid`;
      summary.processed++;
      summary.totalAdded += added;
    } catch (e) {
      const reason = String((e as { message?: string })?.message ?? e).slice(0, 120);
      summary.errors.push({ userId, reason });
    }
  }

  return summary;
}
