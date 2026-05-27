import type { Metadata } from "next";
import Link from "next/link";
import { getSql } from "@/lib/db";
import { getLibraryStats } from "@/lib/library";
import { getLocale } from "@/lib/i18n-server";
import { profileDict } from "@/lib/i18n/profile";
import type { AiProfile } from "@/lib/profile";
import { getMusicZodiac } from "@/lib/musicZodiac";
import { MusicZodiacCard } from "@/components/MusicZodiacCard";
import { AutoTranslateBanner } from "../../profile/AutoTranslateBanner";
import { AiPsychologyDisclaimer } from "@/components/AiPsychologyDisclaimer";

interface SharedRow {
  user_id: string;
  ai_profile: AiProfile | null;
  ai_profile_en: AiProfile | null;
  ai_profile_ko: AiProfile | null;
}

/** Looks up a shared profile by its public id. */
async function loadShared(shareId: string): Promise<SharedRow | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, ai_profile, ai_profile_en, ai_profile_ko
    FROM taste_profiles WHERE share_id = ${shareId}`;
  return (rows[0] as SharedRow | undefined) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const row = await loadShared(shareId);
  const p = row?.ai_profile_en ?? row?.ai_profile ?? undefined;
  if (!p?.persona) return { title: "Earprint" };
  const title = `${p.persona.name} · Earprint`;
  return {
    title,
    description: p.persona.tagline,
    openGraph: { title, description: p.persona.tagline },
    twitter: { card: "summary_large_image", title, description: p.persona.tagline },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const locale = await getLocale();
  const t = profileDict(locale);
  const row = await loadShared(shareId);
  // Is the viewer's locale column populated? If not we fall back to
  // whatever's available, but flag it so the AutoTranslateBanner can
  // kick a lazy translate. We don't auto-translate server-side
  // because that'd add ~500 ms of Gemini latency to every first
  // view — better to render the fallback fast, then refresh once
  // the translation lands.
  const perLocale = (locale === "ko" ? row?.ai_profile_ko : row?.ai_profile_en) as
    | AiProfile
    | null
    | undefined;
  const profile = row
    ? (perLocale ?? row.ai_profile_en ?? row.ai_profile_ko ?? row.ai_profile) as AiProfile | null
    : null;
  const staleLocale = !!profile && !perLocale;

  if (!row || !profile) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
        <p className="text-sm text-neutral-400">{t.shareNotFound}</p>
        <Link
          href="/"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900"
        >
          {t.shareCtaButton}
        </Link>
      </main>
    );
  }

  const stats = await getLibraryStats(row.user_id);
  const feel = stats.audioFeel;
  const zodiac = getMusicZodiac(stats);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-12">
      {staleLocale && (
        <AutoTranslateBanner
          target={locale}
          shareId={shareId}
          t={{ localeMismatch: t.localeMismatch }}
        />
      )}
      <AiPsychologyDisclaimer locale={locale} />
      {zodiac && <MusicZodiacCard data={zodiac} locale={locale} />}

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-bold text-indigo-300">{profile.headline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          {profile.moodProfile}
        </p>
      </section>

      {stats.topGenres.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-sm font-semibold text-neutral-400">{t.favoriteGenres}</h2>
          <div className="flex flex-wrap gap-1.5">
            {stats.topGenres.slice(0, 8).map((g) => (
              <Link
                key={g.name}
                href={`/genre/${encodeURIComponent(g.name)}`}
                className="rounded-md bg-indigo-900/60 px-2 py-0.5 text-xs hover:brightness-125"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {stats.topArtists.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-sm font-semibold text-neutral-400">{t.topArtists}</h2>
          <p className="text-sm text-neutral-300">
            {stats.topArtists.slice(0, 5).map((a) => a.name).join(" · ")}
          </p>
        </section>
      )}

      {feel && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="text-sm font-semibold text-neutral-400">{t.statsTitle}</h2>
          {[
            { label: t.feelEnergy, v: feel.energy },
            { label: t.feelTempo, v: feel.tempo },
            { label: t.feelAcoustic, v: feel.acousticness },
          ].map((a) => (
            <div key={a.label} className="flex items-center gap-3 text-xs">
              <span className="w-16 shrink-0 text-neutral-400">{a.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${Math.round(a.v * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col items-center gap-3 rounded-xl border border-emerald-900/50 bg-neutral-900 p-6 text-center">
        <p className="text-sm text-neutral-400">{t.shareCtaLine}</p>
        <Link
          href="/"
          className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900"
        >
          {t.shareCtaButton}
        </Link>
      </section>
      {/* Spacer so the sticky bar below doesn't cover the page CTA on
          short viewports. */}
      <div className="h-16" aria-hidden="true" />
      {/* Sticky bottom bar — viral loop hook. Shared profiles get
          shown to people who landed here via the OG image or a friend's
          link; without this, ~half the audience never scrolls to the
          page-end CTA. The bar is full-width on mobile, centred and
          narrower on desktop. Backdrop blur so it doesn't fight the
          content underneath. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-900/50 bg-neutral-950/85 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <p className="line-clamp-2 text-xs text-neutral-300 sm:text-sm">
            {t.shareCtaLine}
          </p>
          <Link
            href="/"
            className="shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 sm:px-4 sm:py-2 sm:text-sm"
          >
            {t.shareCtaButton}
          </Link>
        </div>
      </div>
    </main>
  );
}
