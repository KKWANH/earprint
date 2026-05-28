"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { parseYouTubeVideoId } from "@/lib/youtubeId";

const SIZES = [4, 8, 16, 32] as const;

/**
 * Client form: title + 4-32 YouTube URL rows. Dynamic add/remove,
 * inline ID-validity hint per row (green check / red ×). Submit
 * fires POST /api/worldcup/community/create then navigates to the
 * new worldcup's play page.
 *
 * Size is chosen first (radio); the row count auto-adjusts to that
 * size so the user can't accidentally submit a 7-video bracket.
 */
export function CreateForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ko = locale === "ko";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [size, setSize] = useState<(typeof SIZES)[number]>(8);
  const [rows, setRows] = useState<string[]>(() => Array(8).fill(""));
  // Optional per-row thumbnail override. Empty string = use oEmbed's
  // default YouTube thumbnail (server fetches it). User can drop in a
  // Deezer album cover URL or any other https:// image here.
  const [covers, setCovers] = useState<string[]>(() => Array(8).fill(""));
  // Advanced mode toggle — hides the per-row thumbnail input by default
  // so the form stays compact for the 90% path (paste URLs, done).
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── YT playlist bulk-import panel ─────────────────────────────────
  // Optional UI: paste a playlist URL → POST /api/.../resolve-playlist
  // → render the resolved items inline as a checkboxed preview → user
  // clicks "Fill into rows" to copy the picked videoIds into `rows`
  // (and oEmbed thumbnails into `covers`, since the playlist API gives
  // us thumbnails for free and we'd otherwise re-fetch them server-
  // side at create time). Kept collapsed by default so the basic path
  // (paste 16 URLs by hand) stays uncluttered.
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  interface ImportItem {
    videoId: string;
    title: string;
    channelTitle: string | null;
    thumbnailUrl: string | null;
  }
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [importPicked, setImportPicked] = useState<Set<string>>(new Set());

  async function runImport() {
    if (!importUrl.trim() || importBusy) return;
    setImportBusy(true);
    setImportError(null);
    setImportItems([]);
    setImportPicked(new Set());
    try {
      const res = await fetch("/api/worldcup/community/resolve-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const d = (await res.json()) as {
        ok?: boolean;
        items?: ImportItem[];
        error?: string;
      };
      if (!res.ok || !d.ok || !Array.isArray(d.items)) {
        setImportError(d.error ?? `HTTP ${res.status}`);
        setImportBusy(false);
        return;
      }
      setImportItems(d.items);
      // Pre-pick the first `size` items so the user can hit "Fill" in
      // one click for the common "use the top N from this playlist"
      // case. They can still toggle individual checkboxes after.
      const preset = new Set<string>();
      for (const it of d.items.slice(0, size)) preset.add(it.videoId);
      setImportPicked(preset);
    } catch (e) {
      setImportError(String(e));
    } finally {
      setImportBusy(false);
    }
  }

  function fillFromImport() {
    if (importItems.length === 0) return;
    // Maintain the playlist's original order; drop unpicked items.
    const picked = importItems.filter((it) => importPicked.has(it.videoId));
    if (picked.length === 0) {
      setImportError(ko ? "1개 이상 골라 주세요." : "Pick at least one.");
      return;
    }
    // Snap bracket size to the largest power-of-2 ≤ picked count so
    // the user doesn't see "12 / 16" after import. If the user picked
    // more than 32 we truncate to 32 (the form's max).
    const POW2 = [4, 8, 16, 32] as const;
    let nextSize: (typeof POW2)[number] = 4;
    for (const s of POW2) if (picked.length >= s) nextSize = s;
    // Apply size first so the row arrays resize, then fill them.
    setSize(nextSize);
    const usedRows = Array(nextSize).fill("") as string[];
    const usedCovers = Array(nextSize).fill("") as string[];
    for (let i = 0; i < nextSize; i++) {
      const it = picked[i];
      if (!it) break;
      usedRows[i] = `https://www.youtube.com/watch?v=${it.videoId}`;
      // Forward the thumbnail too — saves one oEmbed roundtrip per
      // item on the server side at create time.
      if (it.thumbnailUrl) usedCovers[i] = it.thumbnailUrl;
    }
    setRows(usedRows);
    setCovers(usedCovers);
    // If thumbnails came through, flip on advanced mode so the user
    // can see they've been pre-filled (and can still wipe them).
    if (usedCovers.some(Boolean)) setAdvanced(true);
    setImportOpen(false);
  }

  function setSizeAndResize(n: (typeof SIZES)[number]) {
    setSize(n);
    setRows((cur) => {
      const next = cur.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
    setCovers((cur) => {
      const next = cur.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  }

  function setRow(i: number, val: string) {
    setRows((cur) => {
      const next = cur.slice();
      next[i] = val;
      return next;
    });
  }

  function setCover(i: number, val: string) {
    setCovers((cur) => {
      const next = cur.slice();
      next[i] = val;
      return next;
    });
  }

  // Count how many rows currently parse to a valid YouTube videoId
  // (after dedup). Drives the submit button's enabled state.
  const validIds = new Set<string>();
  for (const r of rows) {
    const id = parseYouTubeVideoId(r);
    if (id) validIds.add(id);
  }
  const validCount = validIds.size;
  const submittable = !busy && title.trim().length > 0 && validCount === size;

  async function submit() {
    if (!submittable) return;
    setBusy(true);
    setError(null);
    try {
      // Parse comma/space-separated tag input into a clean array
      // (server also normalises + caps, but doing it client-side first
      // avoids surprise mismatches in the "5 of 5" UI feedback).
      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t && t.length <= 12)
        .slice(0, 5);
      // Trim the videos + parallel cover-override arrays. Server
      // validates and dedups; here we just send the parallel order.
      const videos = rows.map((r) => r.trim()).filter(Boolean);
      // Covers parallel to videos: empty string means "use oEmbed
      // default". Only forward when at least one cover is filled in
      // (saves bytes on the common path).
      const trimmedCovers = covers.slice(0, videos.length).map((c) => c.trim());
      const hasAnyCover = trimmedCovers.some(Boolean);
      const res = await fetch("/api/worldcup/community/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          videos,
          tags,
          ...(hasAnyCover ? { covers: trimmedCovers } : {}),
        }),
      });
      const d = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !d.ok || !d.id) {
        setError(d.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      router.push(`/worldcup/community/${d.id}`);
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-5"
    >
      {/* Title + optional description */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {ko ? "제목" : "Title"}
        </label>
        <input
          type="text"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={ko ? "예: 90년대 한국 록 명곡 월드컵" : "e.g. 90s K-Rock greatest hits"}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {ko ? "설명 (선택)" : "Description (optional)"}
        </label>
        <textarea
          maxLength={800}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {ko ? "태그 (선택, 최대 5개)" : "Tags (optional, up to 5)"}
        </label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder={
            ko
              ? "쉼표로 구분 · 예: k-pop, idol, 2020s"
              : "Comma-separated · e.g. k-pop, idol, 2020s"
          }
          className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
        />
        <p className="text-[11px] text-neutral-500">
          {ko
            ? "태그가 있으면 커뮤니티 목록에서 같은 태그끼리 묶여 노출돼요."
            : "Tagged worldcups can be filtered together on the community list."}
        </p>
      </div>

      {/* Bracket size selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {ko ? "토너먼트 크기" : "Bracket size"}
        </label>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSizeAndResize(n)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                size === n
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* YT playlist bulk-import — collapsed by default; opens an
          inline panel where the user can paste a playlist URL, see
          the resolved videos with checkboxes, and copy the selection
          into the URL rows in one click. */}
      <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-3">
        <button
          type="button"
          onClick={() => setImportOpen((v) => !v)}
          className="flex items-center justify-between gap-2 text-left text-xs"
        >
          <span className="font-semibold text-emerald-200">
            {ko ? "📋 유튜브 플리에서 가져오기" : "📋 Import from YouTube playlist"}
          </span>
          <span className="text-neutral-500">{importOpen ? "▾" : "▸"}</span>
        </button>
        {importOpen && (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] leading-snug text-neutral-400">
              {ko
                ? "공개 / 미공개(unlisted) 플리만 가능. 개인 '좋아요'·'나중에 볼 동영상'은 YouTube가 외부 API로 못 열어요."
                : "Public or unlisted playlists only. Your personal Liked / Watch Later lists are off-limits to third-party API access."}
            </p>
            <div className="flex gap-2">
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://www.youtube.com/playlist?list=…"
                className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={!importUrl.trim() || importBusy}
                className="shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importBusy
                  ? ko ? "가져오는 중…" : "Loading…"
                  : ko ? "불러오기" : "Load"}
              </button>
            </div>
            {importError && (
              <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-2 py-1.5 text-[11px] text-rose-200">
                {importError}
              </p>
            )}
            {importItems.length > 0 && (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-neutral-400">
                    {ko
                      ? `총 ${importItems.length}개 · ${importPicked.size}개 선택됨`
                      : `${importItems.length} videos · ${importPicked.size} picked`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setImportPicked(
                          new Set(importItems.map((it) => it.videoId)),
                        )
                      }
                      className="text-neutral-500 hover:text-emerald-300"
                    >
                      {ko ? "전체 선택" : "Select all"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportPicked(new Set())}
                      className="text-neutral-500 hover:text-rose-300"
                    >
                      {ko ? "전체 해제" : "Clear"}
                    </button>
                  </div>
                </div>
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-md border border-neutral-800 bg-black/30 p-1">
                  {importItems.map((it) => {
                    const picked = importPicked.has(it.videoId);
                    return (
                      <li key={it.videoId}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-white/5">
                          <input
                            type="checkbox"
                            checked={picked}
                            onChange={() => {
                              setImportPicked((cur) => {
                                const next = new Set(cur);
                                if (next.has(it.videoId)) next.delete(it.videoId);
                                else next.add(it.videoId);
                                return next;
                              });
                            }}
                            className="accent-emerald-500"
                          />
                          {it.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.thumbnailUrl}
                              alt=""
                              className="h-8 w-12 shrink-0 rounded object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-8 w-12 shrink-0 rounded bg-neutral-800" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] text-neutral-100">
                              {it.title}
                            </span>
                            {it.channelTitle && (
                              <span className="block truncate text-[10px] text-neutral-500">
                                {it.channelTitle}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={fillFromImport}
                  disabled={importPicked.size === 0}
                  className="self-start rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ko ? "URL 칸에 채우기" : "Fill into rows"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* YT URL rows */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {ko
              ? `YouTube URL · ${validCount} / ${size}`
              : `YouTube URLs · ${validCount} / ${size}`}
          </label>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            className="text-[10px] text-neutral-500 hover:text-emerald-300"
          >
            {advanced
              ? ko ? "기본 모드" : "Basic"
              : ko ? "썸네일 직접 지정" : "Override thumbnails"}
          </button>
        </div>
        <p className="text-[11px] leading-snug text-neutral-500">
          {ko
            ? "youtube.com / youtu.be / shorts URL 모두 OK. 11자 영상 ID 만 붙여도 됩니다."
            : "youtube.com / youtu.be / shorts URLs all work. 11-character video ID also fine."}
        </p>
        {advanced && (
          <p className="text-[11px] leading-snug text-amber-200/80">
            {ko
              ? "각 행 옆에 썸네일 이미지 URL(앨범 커버 등)을 직접 넣으면 기본 YouTube 썸네일 대신 그걸 씁니다. 비워두면 자동."
              : "Paste a thumbnail URL (album cover etc.) next to each row to override the default YouTube thumbnail. Empty = auto."}
          </p>
        )}
        <ul className="flex flex-col gap-1.5">
          {rows.map((r, i) => {
            const id = parseYouTubeVideoId(r);
            const status = !r.trim() ? "empty" : id ? "ok" : "bad";
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right text-[10px] text-neutral-600 tabular-nums">
                  {i + 1}
                </span>
                <input
                  type="text"
                  value={r}
                  onChange={(e) => setRow(i, e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className={`flex-1 rounded-md border bg-neutral-950 px-2.5 py-1.5 text-xs focus:outline-none ${
                    status === "ok"
                      ? "border-emerald-500/40 focus:border-emerald-500"
                      : status === "bad"
                        ? "border-rose-500/40 focus:border-rose-500"
                        : "border-neutral-700 focus:border-emerald-500"
                  }`}
                />
                <span
                  className={`w-4 shrink-0 text-center text-xs ${
                    status === "ok"
                      ? "text-emerald-400"
                      : status === "bad"
                        ? "text-rose-400"
                        : "text-neutral-700"
                  }`}
                  aria-hidden="true"
                >
                  {status === "ok" ? "✓" : status === "bad" ? "×" : ""}
                </span>
                {advanced && (
                  <input
                    type="url"
                    value={covers[i] ?? ""}
                    onChange={(e) => setCover(i, e.target.value)}
                    placeholder={ko ? "썸네일 URL (선택)" : "Thumbnail URL (optional)"}
                    className="w-40 shrink-0 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[10px] focus:border-amber-500 focus:outline-none sm:w-56"
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {error && (
        <p className="rounded-md border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!submittable}
        className="self-start rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? ko ? "만드는 중…" : "Creating…"
          : ko ? "만들기" : "Create"}
      </button>
    </form>
  );
}
