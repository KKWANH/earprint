import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { getActiveSpotifyConnection, spotifyFetch } from "@/lib/spotify";

/**
 * POST /api/spotify/sync
 *
 * Bulk sync entry point. Runs all four Spotify ingestion paths in
 * sequence inside a single CF Workers invocation:
 *
 *   1. /me/tracks                      → user_tracks (source='spotify')
 *   2. /me/top/tracks (×3 time-ranges) → user_tracks (source='spotify-top')
 *   3. /me/player/recently-played      → user_plays (source='spotify-recent')
 *   4. /me/playlists                   → list refresh in spotify_synced_playlists
 *
 * Each path is independently try/catch'd so a single failure (e.g.
 * the user revoked the user-top-read scope) doesn't poison the whole
 * sync. The summary returned to the client breaks down what worked
 * vs. what didn't so the UI can surface partial results honestly.
 *
 * Append-only across the board. We NEVER delete user_tracks or
 * user_plays in response to a sync — Earprint is a permanent
 * listening history; a Spotify unlike doesn't retroactively erase
 * the fact that the song was once in the user's library.
 */
const MAX_LIKED_PAGES = 20;     // 50 × 20 = 1000 tracks per sync
const TOP_TRACKS_LIMIT = 50;    // Max per time-range; 3 ranges × 50 = 150 calls
const RECENT_LIMIT = 50;        // Spotify hard-caps at 50

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
interface SpotifyTopPage {
  items?: SpotifyTrack[];
}
interface SpotifyArtist {
  id?: string;
  name?: string;
  images?: { url?: string }[];
}
interface SpotifyTopArtistsPage {
  items?: SpotifyArtist[];
}
interface SpotifyRecentlyPlayedPage {
  items?: { played_at?: string; track?: SpotifyTrack | null }[];
}
interface SpotifyPlaylistsPage {
  items?: {
    id?: string;
    name?: string;
    snapshot_id?: string;
    tracks?: { total?: number };
  }[];
  next?: string | null;
}

/**
 * Find-or-create a canonical track row from a Spotify track payload.
 * Strategy:
 *   - ISRC match first (cross-platform key)
 *   - lower(artist) + lower(title) match
 *   - INSERT if neither
 * Also records the spotify-side ID in track_sources, so future
 * sync ticks can short-circuit via the source_id set.
 *
 * Returns null when the track payload is invalid (deleted track,
 * podcast, missing artist).
 */
async function resolveOrCreateTrack(
  sql: ReturnType<typeof getSql>,
  tr: SpotifyTrack | null | undefined,
): Promise<string | null> {
  if (!tr || !tr.id || !tr.name) return null;
  const artist = tr.artists?.[0]?.name?.trim();
  if (!artist) return null;
  let trackId: string | null = null;

  // 1. ISRC — exact cross-platform match (most reliable).
  if (tr.external_ids?.isrc) {
    const r = await sql`
      SELECT id::text AS id FROM tracks WHERE isrc = ${tr.external_ids.isrc} LIMIT 1`;
    if (r.length > 0) trackId = r[0]!.id as string;
  }

  // 2. canon_key — strips "Remastered 2011", "Live", brackets, special
  //    chars; normalizes Korean/Japanese variants. This catches the
  //    common YT Music ⇄ Spotify dedup case where the same song has
  //    different "release version" suffixes per platform. R28e.
  if (!trackId) {
    const r = await sql`
      SELECT id::text AS id FROM tracks
      WHERE canon_key = track_canon_key(${artist}, ${tr.name})
      LIMIT 1`;
    if (r.length > 0) trackId = r[0]!.id as string;
  }

  // 3. Last-ditch exact-lower match — covers tracks whose canon_key
  //    column hasn't been backfilled yet on a partly-migrated deploy.
  if (!trackId) {
    const r = await sql`
      SELECT id::text AS id FROM tracks
      WHERE lower(artist) = ${artist.toLowerCase()}
        AND lower(title) = ${tr.name.toLowerCase()}
      LIMIT 1`;
    if (r.length > 0) trackId = r[0]!.id as string;
  }

  // 4. New track.
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

  // Idempotent source mapping.
  await sql`
    INSERT INTO track_sources (track_id, source, source_id, raw_title, raw_artist)
    VALUES (${trackId}::uuid, 'spotify', ${tr.id}, ${tr.name}, ${artist})
    ON CONFLICT (source, source_id) DO NOTHING`;
  return trackId;
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
  const result = {
    liked:        { added: 0, scanned: 0, more: false, error: null as string | null },
    top:          { added: 0, scanned: 0, error: null as string | null },
    topArtists:   { added: 0, error: null as string | null },
    recent:       { added: 0, scanned: 0, error: null as string | null },
    playlists:    { count: 0, error: null as string | null },
    autoSync:     { triggered: 0, addedTotal: 0, error: null as string | null },
  };

  // ── 1. Liked Songs ──────────────────────────────────────────────
  try {
    const existing = await sql`
      SELECT ts.source_id
      FROM user_tracks ut
      JOIN track_sources ts ON ts.track_id = ut.track_id
      WHERE ut.user_id = ${userId}::uuid AND ts.source = 'spotify'`;
    const seen = new Set(existing.map((r) => r.source_id as string));
    let nextUrl: string | null = "/me/tracks?limit=50";
    let pages = 0;
    while (nextUrl && pages < MAX_LIKED_PAGES) {
      const page: SpotifyTracksPage = await spotifyFetch(conn.accessToken, nextUrl);
      const items = page.items ?? [];
      for (const it of items) {
        result.liked.scanned++;
        const tr = it.track;
        if (!tr?.id || seen.has(tr.id)) continue;
        const trackId = await resolveOrCreateTrack(sql, tr);
        if (!trackId) continue;
        await sql`
          INSERT INTO user_tracks (user_id, track_id, source, liked_at)
          VALUES (
            ${userId}::uuid, ${trackId}::uuid, 'spotify',
            ${it.added_at ?? null}
          )
          ON CONFLICT (user_id, track_id) DO NOTHING`;
        seen.add(tr.id);
        result.liked.added++;
      }
      nextUrl = page.next ?? null;
      pages++;
    }
    result.liked.more = pages >= MAX_LIKED_PAGES && nextUrl != null;
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401) {
      return json({ error: "spotify auth expired — please reconnect" }, 401);
    }
    result.liked.error = String((e as { message?: string })?.message ?? e);
  }

  // ── 2. Top tracks (3 time-ranges combined) ──────────────────────
  // user-top-read may be denied by users who don't want us to see
  // their listening habits; one failed call shouldn't tank the rest.
  try {
    const ranges = ["long_term", "medium_term", "short_term"] as const;
    for (const range of ranges) {
      const page: SpotifyTopPage = await spotifyFetch(
        conn.accessToken,
        `/me/top/tracks?limit=${TOP_TRACKS_LIMIT}&time_range=${range}`,
      );
      const items = page.items ?? [];
      for (const tr of items) {
        result.top.scanned++;
        const trackId = await resolveOrCreateTrack(sql, tr);
        if (!trackId) continue;
        // Insert with source='spotify-top' but ON CONFLICT DO NOTHING
        // keeps a Liked-song row's source='spotify'. Either way, the
        // track is in user_tracks for analysis to pick up.
        const r = await sql`
          INSERT INTO user_tracks (user_id, track_id, source, liked_at)
          VALUES (${userId}::uuid, ${trackId}::uuid, 'spotify-top', NULL)
          ON CONFLICT (user_id, track_id) DO NOTHING
          RETURNING 1`;
        if (r.length > 0) result.top.added++;
      }
    }
  } catch (e) {
    result.top.error = String((e as { message?: string })?.message ?? e);
  }

  // ── 2.5. Top artists (R28b) ─────────────────────────────────────
  // /me/top/artists × 3 time-ranges → spotify_top_artists. Per-user
  // ranked list; useful taste-profile signal distinct from top
  // tracks. Replaces the per-(user, time_range) snapshot each sync
  // — no append-only history kept (recently-played already covers
  // that for tracks; we don't track artist drift over time yet).
  try {
    const ranges = ["long_term", "medium_term", "short_term"] as const;
    for (const range of ranges) {
      const page: SpotifyTopArtistsPage = await spotifyFetch(
        conn.accessToken,
        `/me/top/artists?limit=20&time_range=${range}`,
      );
      const items = page.items ?? [];
      // Clear-then-insert per range so the rank order stays
      // contiguous (a Spotify response with N artists fills ranks
      // 1..N and leaves no stale rows above N).
      await sql`
        DELETE FROM spotify_top_artists
        WHERE user_id = ${userId}::uuid AND time_range = ${range}`;
      for (let i = 0; i < items.length; i++) {
        const a = items[i]!;
        if (!a.id || !a.name) continue;
        await sql`
          INSERT INTO spotify_top_artists
            (user_id, time_range, rank, artist, spotify_id, image_url)
          VALUES (
            ${userId}::uuid, ${range}, ${i + 1},
            ${a.name}, ${a.id}, ${a.images?.[0]?.url ?? null}
          )
          ON CONFLICT (user_id, time_range, rank) DO UPDATE
            SET artist = EXCLUDED.artist,
                spotify_id = EXCLUDED.spotify_id,
                image_url = EXCLUDED.image_url,
                refreshed_at = now()`;
        result.topArtists.added++;
      }
    }
  } catch (e) {
    result.topArtists.error = String((e as { message?: string })?.message ?? e);
  }

  // ── 3. Recently played (user_plays journal) ─────────────────────
  // /me/player/recently-played hard-caps at 50; we accept the cap and
  // sync more on subsequent runs as the user listens.
  try {
    const page: SpotifyRecentlyPlayedPage = await spotifyFetch(
      conn.accessToken,
      `/me/player/recently-played?limit=${RECENT_LIMIT}`,
    );
    const items = page.items ?? [];
    for (const it of items) {
      result.recent.scanned++;
      if (!it.track || !it.played_at) continue;
      const trackId = await resolveOrCreateTrack(sql, it.track);
      if (!trackId) continue;
      // PRIMARY KEY (user_id, track_id, played_at) means duplicates
      // (same track, exact same play time) just no-op. Two separate
      // plays at different times each get their own row.
      const r = await sql`
        INSERT INTO user_plays (user_id, track_id, played_at, source)
        VALUES (
          ${userId}::uuid, ${trackId}::uuid,
          ${it.played_at}::timestamptz, 'spotify-recent'
        )
        ON CONFLICT DO NOTHING
        RETURNING 1`;
      if (r.length > 0) result.recent.added++;
    }
  } catch (e) {
    result.recent.error = String((e as { message?: string })?.message ?? e);
  }

  // ── 4. Playlists (just refresh the listing — content sync is
  //     gated behind explicit per-playlist opt-in via /sync-playlist) ─
  try {
    const page: SpotifyPlaylistsPage = await spotifyFetch(
      conn.accessToken,
      "/me/playlists?limit=50",
    );
    result.playlists.count = page.items?.length ?? 0;
    // Note: we DO NOT insert into spotify_synced_playlists here. That
    // table tracks playlists the user opted INTO syncing; this call
    // is just confirming we have read access. The picker UI hits
    // /api/spotify/playlists separately when the user opens it.
  } catch (e) {
    result.playlists.error = String((e as { message?: string })?.message ?? e);
  }

  // ── 5. Auto-resync opted-in playlists (R28b) ────────────────────
  // For every playlist the user opted into with the picker, hit its
  // /playlists/{id} endpoint to grab the current snapshot_id; if it
  // changed since our last sync, paginate the tracks and append new
  // ones. Skip-when-snapshot-matches keeps this cheap on quiet
  // playlists. Bounded at the playlist's existing per-call limits
  // (8 pages × 100 = 800 tracks) so a runaway playlist doesn't
  // dominate the invocation.
  try {
    const opted = await sql`
      SELECT playlist_id, snapshot_id
      FROM spotify_synced_playlists
      WHERE user_id = ${userId}::uuid`;
    for (const row of opted) {
      const pid = row.playlist_id as string;
      const priorSnap = (row.snapshot_id as string | null) ?? null;
      try {
        const meta = await spotifyFetch<{ snapshot_id?: string; name?: string }>(
          conn.accessToken,
          `/playlists/${pid}?fields=name,snapshot_id`,
        );
        if (priorSnap && meta.snapshot_id && priorSnap === meta.snapshot_id) {
          // Unchanged — just bump last_synced_at to reflect the check.
          await sql`
            UPDATE spotify_synced_playlists
               SET last_synced_at = now()
             WHERE user_id = ${userId}::uuid AND playlist_id = ${pid}`;
          continue;
        }
        result.autoSync.triggered++;
        // Paginate + insert. Reuses the same resolveOrCreateTrack
        // helper and the same per-row INSERT shape as /playlists/[id]
        // /sync; keeping the logic here rather than redirecting via
        // an internal fetch avoids the CF Workers subrequest cost of
        // a self-call.
        let nextUrl: string | null = `/playlists/${pid}/tracks?limit=100`;
        let pages = 0;
        const MAX_PAGES = 8;
        while (nextUrl && pages < MAX_PAGES) {
          const page: SpotifyTracksPage = await spotifyFetch(conn.accessToken, nextUrl);
          for (const it of page.items ?? []) {
            const tr = it.track;
            if (!tr || !tr.id || !tr.name) continue;
            const artist = tr.artists?.[0]?.name?.trim();
            if (!artist) continue;
            const trackId = await resolveOrCreateTrack(sql, tr);
            if (!trackId) continue;
            const r = await sql`
              INSERT INTO user_tracks (user_id, track_id, source, liked_at)
              VALUES (
                ${userId}::uuid, ${trackId}::uuid, 'spotify-playlist',
                ${it.added_at ?? null}
              )
              ON CONFLICT (user_id, track_id) DO NOTHING
              RETURNING 1`;
            if (r.length > 0) result.autoSync.addedTotal++;
          }
          nextUrl = page.next ?? null;
          pages++;
        }
        // Stamp new snapshot.
        await sql`
          UPDATE spotify_synced_playlists
             SET snapshot_id = ${meta.snapshot_id ?? null},
                 name = ${meta.name ?? null},
                 last_synced_at = now()
           WHERE user_id = ${userId}::uuid AND playlist_id = ${pid}`;
      } catch {
        /* per-playlist failure is non-fatal — try the next one */
      }
    }
  } catch (e) {
    result.autoSync.error = String((e as { message?: string })?.message ?? e);
  }

  // Stamp last_synced_at on the connection.
  await sql`
    UPDATE spotify_connections
       SET last_synced_at = now()
     WHERE user_id = ${userId}::uuid`;

  return json({ ok: true, ...result }, 200);
}
