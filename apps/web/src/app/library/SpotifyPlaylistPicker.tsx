"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Expandable playlist picker that hangs off SpotifyConnectCard. Lists
 * the user's Spotify playlists with checkboxes; ticking a row syncs
 * that playlist's contents into user_tracks (source='spotify-playlist'),
 * unticking removes the row from spotify_synced_playlists (imported
 * tracks stay).
 *
 * Loads lazily on expand — /api/spotify/playlists isn't free (4 page
 * fetches against Spotify); we don't want the cost on every /library
 * render. Caches the list in component state once loaded so toggling
 * the picker open/closed within a session doesn't re-fetch.
 *
 * The "Sync all selected" button is intentionally absent — each row
 * has its own per-checkbox commit so the user can see progress
 * incrementally. Batch sync would obscure which playlist is the
 * bottleneck on a slow user account.
 */
interface Playlist {
  id: string;
  name: string;
  ownerName: string | null;
  isOwn: boolean;
  trackCount: number;
  collaborative: boolean;
  image: string | null;
  snapshotId: string | null;
  isSynced: boolean;
  lastSyncedAt: string | null;
}

export function SpotifyPlaylistPicker({ ko }: { ko: boolean }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  // Per-playlist busy spinner — keyed by playlist id so two clicks
  // on different rows don't block each other.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/spotify/playlists");
      const d = (await res.json()) as {
        ok?: boolean;
        playlists?: Playlist[];
        error?: string;
      };
      if (!res.ok || !d.ok || !Array.isArray(d.playlists)) {
        setError(d.error ?? `HTTP ${res.status}`);
        return;
      }
      setPlaylists(d.playlists);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && playlists.length === 0 && !loading) void load();
  }, [open, playlists.length, loading, load]);

  async function toggle(p: Playlist) {
    if (busyIds.has(p.id)) return;
    setBusyIds((s) => new Set(s).add(p.id));
    setRowMessages((m) => ({ ...m, [p.id]: "" }));
    try {
      const want = !p.isSynced;
      const res = await fetch(`/api/spotify/playlists/${p.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(want ? {} : { unsync: true }),
      });
      const d = (await res.json()) as {
        ok?: boolean;
        added?: number;
        scanned?: number;
        skipped?: string;
        error?: string;
      };
      if (!res.ok || !d.ok) {
        setRowMessages((m) => ({
          ...m,
          [p.id]: d.error ?? `HTTP ${res.status}`,
        }));
        return;
      }
      setPlaylists((ps) =>
        ps.map((x) => (x.id === p.id ? { ...x, isSynced: want } : x)),
      );
      if (want) {
        const msg = d.skipped
          ? ko ? "변경 없음 (스킵)" : "no change (skipped)"
          : ko
            ? `${d.added ?? 0}곡 추가 (${d.scanned ?? 0} 검사)`
            : `+${d.added ?? 0} of ${d.scanned ?? 0} scanned`;
        setRowMessages((m) => ({ ...m, [p.id]: msg }));
      } else {
        setRowMessages((m) => ({
          ...m,
          [p.id]: ko ? "동기화 중단됨" : "stopped syncing",
        }));
      }
    } catch (e) {
      setRowMessages((m) => ({ ...m, [p.id]: String(e) }));
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(p.id);
        return n;
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 text-left text-xs text-neutral-300 hover:text-white"
      >
        <span>
          {ko ? "📂 플레이리스트 선택해서 가져오기" : "📂 Pick playlists to import"}
        </span>
        <span className="text-neutral-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          {loading && (
            <p className="text-[11px] text-neutral-500">
              {ko ? "플레이리스트 불러오는 중…" : "Loading playlists…"}
            </p>
          )}
          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-2 py-1.5 text-[11px] text-rose-200">
              {error}
            </p>
          )}
          {!loading && !error && playlists.length === 0 && (
            <p className="text-[11px] text-neutral-500">
              {ko ? "공개 플레이리스트가 없습니다." : "No playlists found."}
            </p>
          )}
          {playlists.length > 0 && (
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-white/10 bg-black/30 p-1">
              {playlists.map((p) => {
                const busy = busyIds.has(p.id);
                const msg = rowMessages[p.id];
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={p.isSynced}
                        disabled={busy}
                        onChange={() => void toggle(p)}
                        className="accent-[#1DB954]"
                      />
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-8 w-8 shrink-0 rounded bg-neutral-800" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] text-neutral-100">
                          {p.name}
                          {p.collaborative && (
                            <span className="ml-1 rounded bg-amber-500/20 px-1 text-[9px] text-amber-200">
                              협업
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[10px] text-neutral-500">
                          {p.trackCount}곡
                          {p.ownerName && !p.isOwn && (
                            <>
                              {" "}· {ko ? "by " : "by "}
                              {p.ownerName}
                            </>
                          )}
                          {msg && (
                            <span className="ml-2 text-[#1DB954]">{msg}</span>
                          )}
                        </span>
                      </span>
                      {busy && (
                        <span className="shrink-0 text-[10px] text-neutral-500">…</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
