import type { Metadata } from "next";
import Link from "next/link";
import { getSql } from "@/lib/db";
import { getLibraryStats } from "@/lib/library";
import { getLocale } from "@/lib/i18n-server";
import { profileDict } from "@/lib/i18n/profile";
import type { AiProfile } from "@/lib/profile";
import { diggingPercentile } from "@/lib/share";

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

  if (!row) {
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

  const profile = ((locale === "ko" ? row.ai_profile_ko : row.ai_profile_en) ??
    row.ai_profile) as AiProfile;
  const [stats, percentile] = await Promise.all([
    getLibraryStats(row.user_id),
    diggingPercentile(profile.diggingScore),
  ]);
  const feel = stats.audioFeel;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-12">
      {/* persona card */}
      {profile.persona && (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/40 via-fuchsia-600/30 to-amber-500/25 p-8 text-center">
          <div className="text-6xl">{profile.persona.emoji}</div>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/60">
            {profile.persona.archetype}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold leading-tight">
            {profile.persona.name}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
            {profile.persona.tagline}
          </p>
          <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5">
              <span className="font-bold text-emerald-300">
                {t.personaScore} {profile.diggingScore}
              </span>
              <span className="text-white/40">/ 100</span>
            </span>
            {percentile != null && (
              <span className="rounded-full bg-black/40 px-4 py-1.5 font-bold text-amber-300">
                {t.topPercent(percentile)}
              </span>
            )}
          </div>
        </section>
      )}

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
              <span
                key={g.name}
                className="rounded-md bg-indigo-900/60 px-2 py-0.5 text-xs"
              >
                {g.name}
              </span>
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
    </main>
  );
}
