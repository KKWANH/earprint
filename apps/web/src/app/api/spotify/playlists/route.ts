import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { json } from "@/lib/http";
import { getActiveSpotifyConnection, spotifyFetch } from "@/lib/spotify";

/**
 * GET /api/spotify/playlists
 *
 * Returns the user's Spotify playlists for the picker UI. Paginated
 * server-side up to 4 pages × 50 = 200 playlists (more than enough
 * for the long tail). Joins against spotify_synced_playlists so the
 * client can show which ones are already opted-in.
 *
 * Doesn't trigger any sync — that's a separate POST. This endpoint
 * is read-only.
 */
interface SpotifyPlaylist {
  id?: string;
  name?: string;
  owner?: { display_name?: string; id?: string };
  snapshot_id?: string;
  tracks?: { total?: number };
  images?: { url?: string }[];
  collaborative?: boolean;
  public?: boolean;
}
interface SpotifyPlaylistsPage {
  items?: SpotifyPlaylist[];
  next?: string | null;
}

const MAX_PAGES = 4;

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return json({ error: "unauthorized" }, 401);
  const { userId } = await ensureConnection();

  const conn = await getActiveSpotifyConnection(userId);
  if (!conn) return json({ error: "not connected" }, 400);

  const all: SpotifyPlaylist[] = [];
  let nextUrl: string | null = "/me/playlists?limit=50";
  let pages = 0;
  try {
    while (nextUrl && pages < MAX_PAGES) {
      const page: SpotifyPlaylistsPage = await spotifyFetch(conn.accessToken, nextUrl);
      const items = page.items ?? [];
      all.push(...items);
      nextUrl = page.next ?? null;
      pages++;
    }
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401) return json({ error: "spotify auth expired" }, 401);
    return json({ error: String((e as { message?: string })?.message ?? e) }, 502);
  }

  // Cross-reference with our synced state.
  const sql = getSql();
  let syncedIds = new Set<string>();
  let syncedRows: Record<string, { lastSyncedAt: string | null }> = {};
  try {
    const rows = await sql`
      SELECT playlist_id, last_synced_at
      FROM spotify_synced_playlists
      WHERE user_id = ${userId}::uuid`;
    for (const r of rows) {
      const id = r.playlist_id as string;
      syncedIds.add(id);
      syncedRows[id] = {
        lastSyncedAt: r.last_synced_at
          ? new Date(r.last_synced_at as string).toISOString()
          : null,
      };
    }
  } catch {
    /* table not yet migrated — every playlist shows as not-synced */
  }

  const out = all
    .filter((p) => p.id && p.name)
    .map((p) => ({
      id: p.id!,
      name: p.name!,
      ownerName: p.owner?.display_name ?? null,
      isOwn: p.owner?.id != null && p.owner.id === conn.spotifyUserId,
      trackCount: p.tracks?.total ?? 0,
      collaborative: !!p.collaborative,
      image: p.images?.[0]?.url ?? null,
      snapshotId: p.snapshot_id ?? null,
      isSynced: syncedIds.has(p.id!),
      lastSyncedAt: syncedRows[p.id!]?.lastSyncedAt ?? null,
    }));

  return json({ ok: true, playlists: out }, 200);
}
