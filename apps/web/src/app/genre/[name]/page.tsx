import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "./BackLink";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getGenreDetail } from "@/lib/genreDetail";
import { genreHue } from "@/lib/forceGraph";
import { getLocale } from "@/lib/i18n-server";
import { genreDict } from "@/lib/i18n/genre";
import { getGenreContent } from "@/data/genre-content";
import { loadRelatedGenres } from "@/lib/relatedGenres";
import { loadWorldcupsByTag } from "@/lib/community-stats";
import { loadWikiSummary } from "@/lib/wikipedia";
import { PreviewButton } from "../../library/PreviewButton";
import { AboutBox } from "./AboutBox";
import { GenreShareButton } from "./GenreShareButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  // R30f — OG image lives at opengraph-image.tsx adjacent; bump
  // twitter card to summary_large_image so the dynamic image
  // renders full-width on X/Twitter share previews.
  return {
    title: `${name} — Earprint`,
    description: `Explore ${name} on Earprint — history, top tracks, your library.`,
    openGraph: { title: `${name} on Earprint`, type: "website" },
    twitter: { card: "summary_large_image" },
  };
}

// R34 — searchParams used for the track-list sort option
export const dynamic = "force-dynamic";

type TrackSort = "alpha" | "added" | "popular";

/** Shared genre detail page — reachable from the library and artist pages. */
export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ tracksSort?: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const sp = await searchParams;
  const tracksSort: TrackSort =
    sp.tracksSort === "added"
      ? "added"
      : sp.tracksSort === "popular"
        ? "popular"
        : "alpha";
  const locale = await getLocale();
  const t = genreDict(locale);

  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: `/genre/${raw}` });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await requireOnboarded();
  // R31f — viewer counter. Best-effort upsert + select. Failure
  // returns null and the view chip just hides. Independent from
  // getGenreDetail to keep the page hot-path light.
  const viewCountPromise = (async (): Promise<number | null> => {
    try {
      const sqlInner = (await import("@/lib/db")).getSql();
      const rows = await sqlInner`
        INSERT INTO genre_views (genre, view_count)
        VALUES (${name.toLowerCase().trim()}, 1)
        ON CONFLICT (genre) DO UPDATE
          SET view_count = genre_views.view_count + 1,
              updated_at = now()
        RETURNING view_count`;
      return Number((rows[0]?.view_count as number) ?? 0);
    } catch {
      return null;
    }
  })();
  const [d, related, taggedWorldcups, viewCount, wiki] = await Promise.all([
    getGenreDetail(userId, name),
    // Related-genres sidebar (R27c). Independent query — failure
    // returns []; the section just hides when empty.
    loadRelatedGenres(name).catch(() => []),
    // R28c — community worldcups tagged with this genre. Cross-link
    // surface so the genre page becomes a discovery hub, not just an
    // info page. Same try/catch fallback.
    loadWorldcupsByTag(name, 3).catch(() => []),
    viewCountPromise,
    // R32e — Wikipedia REST API + 30d cache. Independent failure
    // returns { all-null }, page hides the section in that case.
    loadWikiSummary(name).catch(() => ({
      extractEn: null,
      extractKo: null,
      urlEn: null,
      urlKo: null,
    })),
  ]);
  // Pick the wiki blurb matching the active locale, fall back to
  // whichever language has content. Same pattern as genre-content.
  const wikiExtract =
    (locale === "ko" ? wiki.extractKo : wiki.extractEn) ||
    wiki.extractEn ||
    wiki.extractKo;
  const wikiUrl =
    (locale === "ko" ? wiki.urlKo : wiki.urlEn) || wiki.urlEn || wiki.urlKo;
  // Pre-baked editorial content (emoji / era / origin / history) lives
  // in apps/web/src/data/genre-content.ts. When a genre isn't covered
  // we fall back to the original behaviour (gradient banner with
  // genreHue() + Gemini-warmed `description` only), so the page never
  // looks half-broken for the long tail of niche tags.
  const content = getGenreContent(name);
  const hue = content?.accentHue ?? genreHue(name);
  const description = locale === "ko" ? d.descriptionKo : d.descriptionEn;
  const era = content
    ? locale === "ko" ? content.eraKo : content.eraEn
    : null;
  const origin = content
    ? locale === "ko" ? content.originKo : content.originEn
    : null;
  const history = content
    ? locale === "ko" ? content.historyKo : content.historyEn
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <BackLink label={t.back} fallbackHref="/library" />
        <div className="flex items-center gap-2">
          {/* R30f — native share / clipboard fallback. Surfaces
              the genre's dynamic OG image to Twitter/Discord/Slack
              previews via the page metadata. */}
          <GenreShareButton name={d.name} locale={locale} />
          <Link href="/genres" className="text-xs text-neutral-500 hover:text-white">
            {t.allGenres}
          </Link>
        </div>
      </div>

      {/* Cover image (when curated) — full-bleed 16:9 panel above
          the gradient hero. Uses a hand-picked representative shot
          (Wikimedia Commons / press kit) rather than an API-fed
          stock image, so the page feels editorial rather than
          algorithmic. Credit renders below the image. Hidden
          completely when content.coverImage is absent. */}
      {content?.coverImage && (
        <figure className="flex flex-col gap-1.5">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.coverImage.url}
              alt={content.coverImage.alt}
              className="aspect-[16/9] w-full object-cover"
              loading="lazy"
            />
          </div>
          <figcaption className="text-right text-[10px] text-neutral-600">
            {content.coverImage.credit}
          </figcaption>
        </figure>
      )}

      {/* Coloured genre banner. When pre-baked content is available
          we use its emoji as a big "cover" and surface era/origin
          chips alongside the library count — gives the page an
          immediate "this is what genre X is" identity before the user
          scrolls into the description. Without pre-baked content the
          banner falls back to the legacy gradient + name only. */}
      <header
        className="flex flex-col gap-3 rounded-2xl border border-white/10 p-7"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 55% 24%) 0%, hsl(${
            (hue + 50) % 360
          } 45% 12%) 100%)`,
        }}
      >
        <div className="flex items-start gap-4">
          {content?.emoji && (
            <span
              className="select-none text-5xl leading-none sm:text-6xl"
              aria-hidden="true"
            >
              {content.emoji}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-extrabold capitalize leading-tight sm:text-3xl">
              {d.name}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {d.inLibrary ? (
                <span className="rounded-full bg-black/40 px-3 py-1 font-medium text-white">
                  ♪ {t.inLibrary(d.userTrackCount)}
                </span>
              ) : (
                <span className="rounded-full bg-black/40 px-3 py-1 font-medium text-white/70">
                  {t.notInLibrary}
                </span>
              )}
              {era && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/85">
                  <span className="text-white/55">{t.era}</span> · {era}
                </span>
              )}
              {origin && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/85">
                  <span className="text-white/55">{t.origin}</span> · {origin}
                </span>
              )}
              {/* R31f — view count chip. Hidden until a real number
                  lands (table-missing fallback returns null). The
                  count includes the current view since we increment
                  before reading. */}
              {viewCount != null && viewCount > 1 && (
                <span className="rounded-full bg-white/10 px-3 py-1 text-white/85">
                  👁{" "}
                  {locale === "ko"
                    ? `${viewCount.toLocaleString()}회 조회`
                    : `${viewCount.toLocaleString()} views`}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <Section title={t.about}>
        <AboutBox
          name={d.name}
          initial={description}
          locale={locale}
          emptyText={t.aboutEmpty}
          warmingText={t.aboutWarming ?? t.aboutEmpty}
        />
      </Section>

      {/* R32e — Wikipedia summary + R33 attribution. Wikipedia
          content is CC BY-SA 4.0; surfacing the source domain +
          license tag inline makes the citation visible without
          a separate "credits" page. */}
      {wikiExtract && (
        <Section title={locale === "ko" ? "Wikipedia 소개" : "From Wikipedia"}>
          <p className="text-sm leading-relaxed text-neutral-300">
            {wikiExtract}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {wikiUrl && (
              <a
                href={wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 hover:text-sky-200 hover:underline"
              >
                {locale === "ko" ? "Wikipedia에서 더 보기 →" : "Read on Wikipedia →"}
              </a>
            )}
            <span className="text-neutral-700">·</span>
            <span className="text-neutral-600">
              {locale === "ko" ? "출처: " : "Source: "}
              {wikiUrl ? new URL(wikiUrl).hostname : "wikipedia.org"} ·{" "}
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-400 hover:underline"
              >
                CC BY-SA 4.0
              </a>
            </span>
          </div>
        </Section>
      )}

      {/* Pre-baked editorial history — longer than the one-line About
          box, written by hand or seeded by Gemini through
          scripts/seed-genre-content.mjs. Hidden when no pre-baked
          content exists for this genre so we never surface an empty
          "역사" section header. */}
      {history && (
        <Section title={t.history}>
          <p className="text-sm leading-relaxed text-neutral-300">
            {history}
          </p>
        </Section>
      )}

      {d.topArtists.length > 0 && (
        <Section title={t.topArtists}>
          <div className="flex flex-wrap gap-1.5">
            {d.topArtists.map((a) => (
              <Link
                key={a}
                href={`/artist/${encodeURIComponent(a)}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 hover:border-emerald-500/50 hover:text-white"
              >
                {a}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {d.topTracks.length > 0 && (
        <Section title={t.topTracks}>
          <div className="flex flex-col gap-1">
            {d.topTracks.map((tr, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 border-b border-neutral-800/60 py-1.5 text-sm last:border-0"
              >
                <span className="truncate">{tr.title}</span>
                <Link
                  href={`/artist/${encodeURIComponent(tr.artist)}`}
                  className="ml-auto shrink-0 text-xs text-neutral-500 hover:text-white hover:underline"
                >
                  {tr.artist}
                </Link>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* R29b — audio feel summary for this user's tracks in this
          genre. Three sky-toned bars (energy / tempo / acousticness)
          with the average value rendered as a fill width. Hidden
          when none of the user's matching tracks have been
          audio_feel-analyzed yet, since "0 analyzed" would mean
          empty bars. */}
      {d.audioFeel && (
        <Section
          title={
            locale === "ko"
              ? `이 장르의 사운드 (${d.audioFeel.analyzed}곡 평균)`
              : `Sound of this genre (avg of ${d.audioFeel.analyzed} of your tracks)`
          }
        >
          <div className="flex flex-col gap-3">
            {(
              [
                {
                  label: locale === "ko" ? "에너지" : "Energy",
                  lo: locale === "ko" ? "차분" : "Calm",
                  hi: locale === "ko" ? "강렬" : "Intense",
                  v: d.audioFeel.energy,
                },
                {
                  label: locale === "ko" ? "템포" : "Tempo",
                  lo: locale === "ko" ? "느림" : "Slow",
                  hi: locale === "ko" ? "빠름" : "Fast",
                  v: d.audioFeel.tempo,
                },
                {
                  label: locale === "ko" ? "음색" : "Sound",
                  lo: locale === "ko" ? "전자음" : "Electronic",
                  hi: locale === "ko" ? "어쿠스틱" : "Acoustic",
                  v: d.audioFeel.acousticness,
                },
              ] as const
            ).map((axis) => (
              <div key={axis.label} className="flex items-center gap-3 text-xs">
                <span className="w-12 shrink-0 text-neutral-300">
                  {axis.label}
                </span>
                <span className="w-12 shrink-0 text-right text-[10px] text-neutral-600">
                  {axis.lo}
                </span>
                <div className="relative h-2 flex-1 rounded-full bg-neutral-800">
                  <div
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-sky-400"
                    style={{
                      left: `calc(${Math.round(Math.max(0, Math.min(1, axis.v)) * 100)}% - 7px)`,
                    }}
                  />
                </div>
                <span className="w-12 shrink-0 text-[10px] text-neutral-600">
                  {axis.hi}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.userTracks.length > 0 && (() => {
        // R34 — sort the user tracks per the active option. The
        // SQL already ORDER BY artist,title so default 'alpha' is
        // a no-op; 'added' uses captured_at desc (newest first);
        // 'popular' uses deezer_rank asc (lower rank = more
        // popular on Deezer).
        const sorted = [...d.userTracks];
        if (tracksSort === "added") {
          sorted.sort(
            (a, b) =>
              (b.capturedAt?.getTime() ?? 0) - (a.capturedAt?.getTime() ?? 0),
          );
        } else if (tracksSort === "popular") {
          sorted.sort((a, b) => {
            const ar = a.deezerRank ?? Number.MAX_SAFE_INTEGER;
            const br = b.deezerRank ?? Number.MAX_SAFE_INTEGER;
            return ar - br;
          });
        }
        const sortTab = (id: TrackSort, label: string) => {
          const active = tracksSort === id;
          const qp = new URLSearchParams();
          if (id !== "alpha") qp.set("tracksSort", id);
          const qs = qp.toString();
          const href = qs
            ? `/genre/${encodeURIComponent(name)}?${qs}`
            : `/genre/${encodeURIComponent(name)}`;
          return (
            <Link
              key={id}
              href={href}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                active
                  ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40 hover:text-neutral-200"
              }`}
            >
              {label}
            </Link>
          );
        };
        return (
          <Section title={t.yourTracks}>
            <div className="flex flex-wrap gap-1.5">
              {sortTab("alpha", locale === "ko" ? "🔤 가나다순" : "🔤 A → Z")}
              {sortTab("added", locale === "ko" ? "🆕 추가순" : "🆕 Added")}
              {sortTab("popular", locale === "ko" ? "🔥 인기순" : "🔥 Popular")}
            </div>
            <div className="flex flex-col gap-1">
              {sorted.map((tr, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 border-b border-neutral-800/60 py-1.5 text-sm last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {tr.title}
                    <span className="text-neutral-500"> · {tr.artist}</span>
                  </span>
                  <PreviewButton deezerId={tr.deezerId} locale={locale} />
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* Community worldcups tagged with this genre (R28c) — the
          genre page becomes a discovery hub: not just "what is this
          genre" but "what brackets exist for it?". Hidden when no
          public worldcup carries this tag; the "make one" CTA below
          still renders so first-mover users can fill the gap. */}
      {taggedWorldcups.length > 0 && (
        <Section
          title={
            locale === "ko" ? "이 장르의 커뮤니티 월드컵" : "Community worldcups in this genre"
          }
        >
          <div className="flex flex-col gap-2">
            {taggedWorldcups.map((w) => (
              <Link
                key={w.id}
                href={`/worldcup/community/${w.id}`}
                className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/10"
              >
                <div className="grid h-12 w-12 shrink-0 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded bg-black/40">
                  {Array.from({ length: 4 }).map((_, i) => {
                    const p = w.previews[i];
                    return p?.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={p.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div key={i} className="bg-emerald-500/10" />
                    );
                  })}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-white">
                    {w.title}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    {w.itemCount}
                    {locale === "ko" ? "강" : "-slot"} ·{" "}
                    {w.playCount.toLocaleString()}
                    {locale === "ko" ? "회 진행" : " plays"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            href={`/worldcup/community/create?tag=${encodeURIComponent(name.toLowerCase())}`}
            className="mt-1 self-start text-xs text-emerald-300 hover:text-emerald-200 hover:underline"
          >
            {locale === "ko"
              ? "+ 이 장르로 새 월드컵 만들기"
              : "+ Create a new worldcup with this genre"}
          </Link>
        </Section>
      )}
      {/* When no worldcup matches yet, surface a leaner first-mover
          CTA — saves the user a click to /worldcup/community/create
          when they're already on the right genre page. */}
      {taggedWorldcups.length === 0 && (
        <Link
          href={`/worldcup/community/create?tag=${encodeURIComponent(name.toLowerCase())}`}
          className="self-start rounded-md border border-emerald-500/30 bg-emerald-950/15 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/15"
        >
          {locale === "ko"
            ? `+ '${d.name}' 첫 번째 월드컵 만들기`
            : `+ Be the first to create a '${d.name}' worldcup`}
        </Link>
      )}

      {/* Related genres (R27c) — merged ranking of three signals:
          same family (genreDict taxonomy), same era (curated content
          comparison), and co-occurrence (jsonb keys that appear
          alongside this one in the analysis table). Each chip carries
          a title attribute spelling out which signal(s) introduced
          the suggestion so curious users can see the reasoning. */}
      {related.length > 0 && (
        <Section title={locale === "ko" ? "관련 장르" : "Related genres"}>
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) => {
              const reasonLabel = r.reasons
                .map((x) =>
                  locale === "ko"
                    ? x === "family"
                      ? "같은 패밀리"
                      : x === "era"
                        ? "같은 시기"
                        : "함께 등장"
                    : x === "family"
                      ? "same family"
                      : x === "era"
                        ? "same era"
                        : "co-occurs",
                )
                .join(" · ");
              return (
                <Link
                  key={r.name}
                  href={`/genre/${encodeURIComponent(r.name)}`}
                  title={reasonLabel}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 hover:border-emerald-500/50 hover:text-white"
                >
                  {r.name}
                </Link>
              );
            })}
          </div>
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
