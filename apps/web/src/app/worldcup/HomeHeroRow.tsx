import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { worldcupDict } from "@/lib/i18n/worldcup";
import { WORLDCUP_SIZES, type WorldcupCategory } from "@/lib/worldcup";

/**
 * R32b — compact 3-hero replacing the old "3 product cards + 6
 * category cards + size buttons" wall. Each hero is a native
 * <details>/<summary> that expands inline to show the mode/size
 * picker. No client JS — browser handles the collapse.
 *
 * Cards:
 *   1. "내 음악 월드컵" (was "AI 큐레이션") — combines every
 *      self-bracket mode (library / recent / forgotten / genre /
 *      AI-curated) plus a size selector per row. Disabled sizes
 *      render as inert spans so the user sees why they can't pick
 *      them ("not enough songs in that bucket").
 *   2. "새 곡 디깅" (Discover) — just a size selector since
 *      Discover's data source is one (recommendations table).
 *   3. "커뮤니티" — plain link to /worldcup/community (no picker).
 */

interface HomeHeroRowProps {
  locale: Locale;
  /** per-category candidate counts for size-button gating */
  counts: Record<Exclude<WorldcupCategory, "liked">, number>;
}

const SELF_MODES = [
  { id: "library",   emoji: "🎲" },
  { id: "recent",    emoji: "⚡" },
  { id: "forgotten", emoji: "🕰" },
  { id: "genre",     emoji: "🎼" },
  // AI-curated has its own route (/worldcup/curate/[size]) so it
  // gets a distinct hrefBase below.
  { id: "curate",    emoji: "✨" },
] as const;

type SelfModeId = (typeof SELF_MODES)[number]["id"];

function hrefForSelfMode(id: SelfModeId, size: number): string {
  if (id === "curate") return `/worldcup/curate/${size}`;
  if (id === "genre")  return `/worldcup/genre/${size}`;
  return `/worldcup/${id}/${size}`;
}

function countForSelfMode(
  id: SelfModeId,
  counts: HomeHeroRowProps["counts"],
): number {
  // AI-curated draws from the same library pool as `library` mode
  // but with a Gemini ranker on top — gating is whether the user
  // has ≥4 tracks at all.
  if (id === "curate")  return counts.library;
  if (id === "library") return counts.library;
  if (id === "recent")  return counts.recent;
  if (id === "forgotten") return counts.forgotten;
  if (id === "genre")   return counts.genre;
  return 0;
}

export function HomeHeroRow({ locale, counts }: HomeHeroRowProps) {
  const t = worldcupDict(locale);
  const ko = locale === "ko";

  // Localized labels for the 5 self-modes. Keeping them mapped here
  // rather than in the i18n file because the curate entry is new
  // and the existing dict doesn't carry it yet — the others reuse
  // the existing strings unchanged.
  const selfLabel = (id: SelfModeId): string => {
    if (id === "library") return t.catLibraryLabel;
    if (id === "recent") return t.catRecentLabel;
    if (id === "forgotten") return t.catForgottenLabel;
    if (id === "genre") return t.catGenreLabel;
    if (id === "curate") return ko ? "AI 큐레이션" : "AI-curated";
    return id;
  };

  const myCardHeader = ko ? "🏆 내 음악 월드컵" : "🏆 My music worldcup";
  const myCardHint = ko
    ? "라이브러리·잊은 명곡·장르·AI 큐레이션 — 한 곳에서 시작"
    : "Library / forgotten / genre / AI-curated — pick one and a size";
  const discoverHeader = ko ? "🧭 새 곡 디깅" : "🧭 Discover new";
  const discoverHint = ko
    ? "내 취향 밖 곡들로 토너먼트"
    : "Tournament with fresh picks outside your usual taste";
  const communityHeader = ko ? "🌐 커뮤니티" : "🌐 Community";
  const communityHint = ko
    ? "다른 사람이 만든 월드컵"
    : "Worldcups made by others";

  return (
    <section className="flex flex-col gap-3">
      {/* Card 1 — self-bracket modes × sizes. Native <details>
          collapse so this stays pure server-rendered. */}
      <details className="group rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-neutral-950 to-neutral-900 transition-colors open:border-emerald-400/60 hover:border-emerald-400/50">
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 p-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-white">{myCardHeader}</span>
            <span className="text-xs text-neutral-400">{myCardHint}</span>
          </div>
          <span className="text-neutral-500 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="flex flex-col gap-1.5 border-t border-white/5 px-5 py-4">
          {SELF_MODES.map((m) => {
            const have = countForSelfMode(m.id, counts);
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 text-sm"
              >
                <span className="w-32 shrink-0 text-neutral-200">
                  {m.emoji} {selfLabel(m.id)}
                </span>
                <div className="flex flex-wrap gap-1">
                  {WORLDCUP_SIZES.map((s) => {
                    const enough = have >= s;
                    return enough ? (
                      <Link
                        key={s}
                        href={hrefForSelfMode(m.id, s)}
                        className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-neutral-200 hover:border-emerald-500/60 hover:bg-emerald-500/10 hover:text-emerald-200"
                      >
                        {s}
                        {ko ? "강" : ""}
                      </Link>
                    ) : (
                      <span
                        key={s}
                        title={t.notEnough(have, s)}
                        className="rounded-md border border-white/5 bg-black/10 px-2 py-1 text-xs text-neutral-600"
                      >
                        {s}
                        {ko ? "강" : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </details>

      {/* Card 2 — Discover size picker. Smaller since there's only
          one row of buttons. */}
      <details className="group rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-950/30 via-neutral-950 to-neutral-900 transition-colors open:border-sky-400/60 hover:border-sky-400/50">
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 p-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-white">{discoverHeader}</span>
            <span className="text-xs text-neutral-400">{discoverHint}</span>
          </div>
          <span className="text-neutral-500 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="flex flex-wrap gap-2 border-t border-white/5 px-5 py-4">
          {WORLDCUP_SIZES.map((s) => {
            const enough = counts.discover >= s;
            return enough ? (
              <Link
                key={s}
                href={`/worldcup/discover/${s}`}
                className="rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:border-sky-500/60 hover:bg-sky-500/10 hover:text-sky-200"
              >
                {s}
                {ko ? "강" : ""}
              </Link>
            ) : (
              <span
                key={s}
                title={t.notEnough(counts.discover, s)}
                className="rounded-md border border-white/5 bg-black/10 px-3 py-1.5 text-sm text-neutral-600"
              >
                {s}
                {ko ? "강" : ""}
              </span>
            );
          })}
        </div>
      </details>

      {/* Card 3 — Community is a plain link, no picker. */}
      <Link
        href="/worldcup/community"
        className="flex items-baseline justify-between gap-2 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-neutral-950 to-neutral-900 p-5 transition-colors hover:border-amber-400/60 hover:bg-amber-500/10"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-bold text-white">{communityHeader}</span>
          <span className="text-xs text-neutral-400">{communityHint}</span>
        </div>
        <span className="text-amber-300">→</span>
      </Link>
    </section>
  );
}
