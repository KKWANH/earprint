import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { getActiveSpotifyConnection, spotifyFetch } from "@/lib/spotify";

/**
 * POST /api/spotify/sync
 *
 * Pulls the user's Spotify Liked Songs (`/me/tracks`) and appends any
 * new ones into our `tracks` + `user_tracks` tables, mirroring the
 * shape the YT Music extension uses (source='spotify'). Append-only:
 * NEVER deletes a user_tracks row in response to a sync — Earprint
 * is meant to be a permanent listening history, and a Spotify
 * "unlike" doesn't mean the user wants the song to disappear from
 * their Earprint analytics.
 *
 * Pagination: /me/tracks returns at most 50 per page. We follow
 * `next` until exhaustion OR until we hit MAX_PAGES (to avoid
 * burning subrequests on a user with 100k+ saved tracks on the
 * first sync — they can re-run to keep going). Subsequent syncs
 * stop early when we encounter a `added_at` we already imported.
 *
 * Dedup: per-track uniqueness uses the (artist, title) normalised
 * key already enforced by our tracks table's lower(artist) +
 * lower(title) index. Spotify track ID is stored in track_sources
 * so future endpoints (e.g. "preview Spotify track") can find the
 * canonical row.
 */
const MAX_PAGES = 20; // 50 × 20 = 1000 tracks per sync. Re-run for more.

interface SpotifyTrack {
  id?: string;
  name?: string;
  artists?: { name?: string; id?: string }[];
  album?: { name?: string; release_date?: string };
  duration_ms?: number;
  external_ids?: { isrc?: string };
}
interface SpotifyTracksPage {
  items?: { added_at?: string; track?: SpotifyTrack | null }[];
  next?: string | null;
  total?: number;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();

  const conn = await getActiveSpotifyConnection(userId);
  if (!conn) {
    return json(
      { error: "Spotify not connected. Connect first via /api/auth/spotify/start." },
      400,
    );
  }

  const sql = getSql();
  // Pull the set of Spotify source_ids already imported for this user
  // so we can skip them quickly. This is a single read; for a 1k-track
  // library it's a few KB over the wire.
  let alreadyHaveSpotifyIds: Set<string>;
  try {
    const existing = await sql`
      SELECT ts.source_id
      FROM user_tracks ut
      JOIN track_sources ts ON ts.track_id = ut.track_id
      WHERE ut.user_id = ${userId}::uuid
        AND ts.source = 'spotify'`;
    alreadyHaveSpotifyIds = new Set(
      existing.map((r) => r.source_id as string),
    );
  } catch (e) {
    console.error("[spotify-sync] dedup query failed:", e);
    alreadyHaveSpotifyIds = new Set();
  }

  let added = 0;
  let skipped = 0;
  let scanned = 0;
  let nextUrl: string | null = "/me/tracks?limit=50";
  let pages = 0;

  try {
    while (nextUrl && pages < MAX_PAGES) {
      const page: SpotifyTracksPage = await spotifyFetch(conn.accessToken, nextUrl);
      const items = page.items ?? [];
      for (const it of items) {
        scanned++;
        const tr = it.track;
        if (!tr || !tr.id || !tr.name) continue;
        const artist = tr.artists?.[0]?.name?.trim();
        if (!artist) continue;
        if (alreadyHaveSpotifyIds.has(tr.id)) {
          skipped++;
          continue;
        }

        // Find-or-create the canonical track row. Match strategy: ISRC
        // first (most reliable cross-platform key), fall back to a
        // case-insensitive (artist, title) lookup (matches how the
        // YT Music extension's tracks get deduplicated).
        let trackId: string | null = null;
        if (tr.external_ids?.isrc) {
          const r = await sql`
            SELECT id::text AS id FROM tracks
            WHERE isrc = ${tr.external_ids.isrc}
            LIMIT 1`;
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
              ${tr.name},
              ${artist},
              ${tr.album?.name ?? null},
              ${tr.duration_ms ?? null},
              ${tr.external_ids?.isrc ?? null}
            )
            RETURNING id::text AS id`;
          trackId = r[0]!.id as string;
        }

        // Record the Spotify source_id mapping. ON CONFLICT (source,
        // source_id) DO NOTHING handles the race where two parallel
        // syncs see the same id (unlikely; sync is single-button).
        await sql`
          INSERT INTO track_sources (track_id, source, source_id, raw_title, raw_artist)
          VALUES (${trackId}::uuid, 'spotify', ${tr.id}, ${tr.name}, ${artist})
          ON CONFLICT (source, source_id) DO NOTHING`;

        // Like-row. PRIMARY KEY (user_id, track_id) means a track
        // already liked via YT Music doesn't double-insert — we just
        // skip. liked_at is added_at from Spotify (when they hit
        // ❤ in Spotify); captured_at is now() (when WE saw it).
        const addedAtIso = it.added_at ?? null;
        await sql`
          INSERT INTO user_tracks (user_id, track_id, source, liked_at)
          VALUES (
            ${userId}::uuid, ${trackId}::uuid, 'spotify',
            ${addedAtIso ? `${addedAtIso}` : null}
          )
          ON CONFLICT (user_id, track_id) DO NOTHING`;

        alreadyHaveSpotifyIds.add(tr.id);
        added++;
      }
      nextUrl = page.next ?? null;
      pages++;
    }
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401) {
      // Token genuinely revoked — connection helper already wrote a
      // refresh attempt back. Surface to UI so it re-prompts.
      return json({ error: "spotify auth expired — please reconnect" }, 401);
    }
    console.error("[spotify-sync] mid-sync error:", e);
    return json({ error: "sync failed", added, skipped, scanned }, 500);
  }

  // Stamp last_synced_at — used by the UI to render "Last synced 3
  // minutes ago" and to gate the visible "Sync now" cooldown if we
  // ever add one.
  await sql`
    UPDATE spotify_connections
       SET last_synced_at = now()
     WHERE user_id = ${userId}::uuid`;

  return json(
    {
      ok: true,
      added,
      skipped,
      scanned,
      reachedMaxPages: pages >= MAX_PAGES && nextUrl != null,
    },
    200,
  );
}
