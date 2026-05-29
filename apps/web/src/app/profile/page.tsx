import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getGenreMap } from "@/lib/genreMap";
import { getLibraryStats, type AudioFeelAgg, type LibraryStats } from "@/lib/library";
import type { AiProfile } from "@/lib/profile";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { profileDict } from "@/lib/i18n/profile";
import { diggingPercentile, newShareId } from "@/lib/share";
import { getMusicZodiac, type MusicZodiac } from "@/lib/musicZodiac";
import { LikesDisclaimer } from "@/components/LikesDisclaimer";
import { AiPsychologyDisclaimer } from "@/components/AiPsychologyDisclaimer";
import { TasteDNASections } from "@/components/TasteDNASections";
import { MusicZodiacCard } from "@/components/MusicZodiacCard";
import { GenerateButton } from "./GenerateButton";
import { GenreConstellation } from "./GenreConstellation";
import { ShareButton } from "./ShareButton";
import { AutoTranslateBanner } from "./AutoTranslateBanner";

export async function generateMetadata(): Promise<Metadata> {
  const t = profileDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

export default async function ProfilePage() {
  const locale = await getLocale();
  const t = profileDict(locale);
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/profile" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.signInWithGoogle}
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await requireOnboarded();
  const sql = getSql();
  const rows = await sql`
    SELECT ai_profile, ai_profile_en, ai_profile_ko, ai_generated_at, ai_locale, share_id
    FROM taste_profiles WHERE user_id = ${userId}`;
  // Prefer the profile stored in the current language; fall back to the legacy
  // single-language column for rows generated before bilingual storage.
  const perLocale = (locale === "ko"
    ? rows[0]?.ai_profile_ko
    : rows[0]?.ai_profile_en) as AiProfile | undefined;
  const profile = perLocale ?? (rows[0]?.ai_profile as AiProfile | undefined) ?? null;
  const generatedAt = rows[0]?.ai_generated_at as string | undefined;
  const aiLocale = rows[0]?.ai_locale as string | undefined;
  // Only legacy rows (no per-locale copy) can show the wrong language.
  const staleLocale = !perLocale && !!profile && !!aiLocale && aiLocale !== locale;

  // Backfill a share id for profiles generated before sharing existed.
  // RETURNING + re-read keeps it correct if two renders race the update.
  let shareId = rows[0]?.share_id as string | undefined;
  if (profile && !shareId) {
    const upd = await sql`
      UPDATE taste_profiles SET share_id = ${newShareId()}
      WHERE user_id = ${userId} AND share_id IS NULL
      RETURNING share_id`;
    shareId =
      (upd[0]?.share_id as string | undefined) ??
      ((await sql`SELECT share_id FROM taste_profiles WHERE user_id = ${userId}`)[0]
        ?.share_id as string | undefined);
  }

  const [genreMap, stats, percentile, spotifyState] = await Promise.all([
    getGenreMap(userId),
    getLibraryStats(userId),
    profile ? diggingPercentile(profile.diggingScore) : Promise.resolve(null),
    // R28l — surface "Spotify connected · synced X" beside the page
    // title. Cheap one-row read; degrades to null when the table
    // hasn't been migrated yet, which the badge handles by hiding.
    (async () => {
      try {
        const r = await sql`
          SELECT last_synced_at FROM spotify_connections
          WHERE user_id = ${userId}::uuid LIMIT 1`;
        if (r.length === 0) return null;
        return {
          lastSyncedAt: r[0]!.last_synced_at
            ? new Date(r[0]!.last_synced_at as string)
            : null,
        };
      } catch {
        return null;
      }
    })(),
  ]);
  const zodiac = getMusicZodiac(stats);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        {/* R28l — Spotify connection badge. Linked to /library where
            the actual Sync / Disconnect controls live, so users
            don't try to manage the connection from this surface. */}
        {spotifyState && (
          <Link
            href="/library#spotify"
            className="flex items-center gap-1.5 rounded-full border border-[#1DB954]/30 bg-[#1DB954]/10 px-2.5 py-0.5 text-[11px] text-[#1DB954] hover:bg-[#1DB954]/20"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1DB954]" />
            {locale === "ko" ? "Spotify 연결됨" : "Spotify connected"}
            {spotifyState.lastSyncedAt && (
              <span className="text-[#1DB954]/70">
                · {spotifyState.lastSyncedAt.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </Link>
        )}
      </div>
      <LikesDisclaimer locale={locale} />
      <AiPsychologyDisclaimer locale={locale} />

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-sm text-neutral-400">{t.introText}</p>
        <GenerateButton hasProfile={!!profile} locale={locale} />
        {generatedAt && (
          <p className="text-xs text-neutral-500">
            {t.generatedAt} {new Date(generatedAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
          </p>
        )}
        {staleLocale && (
          // R28g — slice down to the exact field the client component
          // needs. Passing the whole `t` dict here used to crash the
          // page with React #419 because `profileDict()` includes a
          // `topPercent: (n) => string` function and RSC can't
          // serialise functions across the server→client boundary.
          // Same bug pattern as R22c (InProgressCard).
          <AutoTranslateBanner
            target={locale}
            t={{ localeMismatch: t.localeMismatch }}
          />
        )}
      </section>

      {profile && shareId && (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-900/50 bg-neutral-900 p-6">
          <h2 className="font-semibold text-emerald-300">{t.shareHeading}</h2>
          <ShareButton shareId={shareId} locale={locale} />
        </section>
      )}

      {stats.total > 0 && <StatsSection stats={stats} t={t} />}

      {genreMap.nodes.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <div>
            <h2 className="font-semibold">{t.constellationTitle}</h2>
            <p className="text-sm text-neutral-400">{t.constellationDesc}</p>
          </div>
          <GenreConstellation data={genreMap} locale={locale} />
        </section>
      )}

      {profile ? (
        <ProfileView
          profile={profile}
          percentile={percentile}
          zodiac={zodiac}
          locale={locale}
          t={t}
        />
      ) : (
        <p className="text-sm text-neutral-500">{t.noProfile}</p>
      )}

      {/* Taste DNA — imprint + novelty sections that used to live on
          the standalone /dna page. /dna now redirects here so the
          user gets the unified insights view the brief asked for
          ("취향 DNA 랑 심리분석을 합치는건 어떨까"). */}
      {stats.total > 0 && (
        <TasteDNASections userId={userId} locale={locale} />
      )}
    </main>
  );
}

type ProfileT = ReturnType<typeof profileDict>;

/** "The data behind the analysis" — the library figures the AI reads. */
function StatsSection({ stats, t }: { stats: LibraryStats; t: ProfileT }) {
  const top = stats.topGenres[0];
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <h2 className="font-semibold">{t.statsTitle}</h2>
        <p className="text-sm text-neutral-400">{t.statsDesc}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Stat label={t.statSongs} value={stats.total.toLocaleString()} />
        <Stat label={t.statArtists} value={stats.distinctArtists.toLocaleString()} />
        <Stat label={t.statAnalyzed} value={stats.enriched.toLocaleString()} />
        <Stat
          label={t.statAlbumDepth}
          value={`${Math.round(stats.albumDepth.concentration * 100)}%`}
        />
      </div>
      {top && (
        <p className="text-xs text-neutral-500">
          {t.statTopGenre}: <span className="text-neutral-300">{top.name}</span> ({top.count})
        </p>
      )}
      {stats.audioFeel && <FeelBars feel={stats.audioFeel} t={t} />}
    </section>
  );
}

/**
 * Single axis bar — labelled left, 0-100 value bar in the middle,
 * numeric right. Hue lets each axis carry its own colour so the four
 * bars scan visually instead of looking like four indistinct rows.
 */
function AxisBar({ label, value, hue }: { label: string; value: number; hue: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-20 shrink-0 text-neutral-400 sm:w-24">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full"
          style={{
            width: `${v}%`,
            background: `linear-gradient(90deg, hsl(${hue} 70% 35%) 0%, hsl(${hue} 75% 55%) 100%)`,
          }}
        />
      </div>
      <span className="w-7 shrink-0 text-right tabular-nums text-neutral-300">{v}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}

function FeelBars({ feel, t }: { feel: AudioFeelAgg; t: ProfileT }) {
  const axes = [
    { label: t.feelEnergy, v: feel.energy },
    { label: t.feelTempo, v: feel.tempo },
    { label: t.feelAcoustic, v: feel.acousticness },
  ];
  return (
    <div className="flex flex-col gap-2">
      {axes.map((a) => (
        <div key={a.label} className="flex items-center gap-3 text-xs">
          <span className="w-16 shrink-0 text-neutral-400">{a.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-sky-400"
              style={{ width: `${Math.round(a.v * 100)}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-neutral-500">
            {Math.round(a.v * 100)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ProfileView({
  profile: p,
  percentile,
  zodiac,
  locale,
  t,
}: {
  profile: AiProfile;
  percentile: number | null;
  zodiac: MusicZodiac | null;
  locale: Locale;
  t: ProfileT;
}) {
  return (
    <div className="flex flex-col gap-6">
      {zodiac && <MusicZodiacCard data={zodiac} locale={locale} />}

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-xl font-bold text-indigo-300">{p.headline}</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">{p.personality}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(p.traits ?? []).map((t) => (
            <span key={t} className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-center gap-5">
          <div className="flex flex-col items-center">
            <div className="text-3xl font-bold text-emerald-400 sm:text-4xl">{p.diggingScore}</div>
            <div className="text-xs text-neutral-500">{t.diggingScore}</div>
            {percentile != null && (
              <div className="mt-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                {t.topPercent(percentile)}
              </div>
            )}
          </div>
          <p className="flex-1 text-sm text-neutral-300">{p.diggingComment}</p>
        </div>
        {/* Four-axis breakdown (May 2026). Optional — only shown when
            the profile was generated with the new Gemini prompt that
            populates axisScores. Old profiles in taste_profiles just
            fall back to the single-number display above. The hint
            line under the bars is important — testers were reading
            the overall number as a grade ("I got 45?!"); the bars
            make it obvious that being strong on one axis is fine. */}
        {p.axisScores && (
          <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
            <AxisBar label={t.axisGenreBreadth} value={p.axisScores.genreBreadth} hue={200} />
            <AxisBar label={t.axisAlbumDepth}   value={p.axisScores.albumDepth}   hue={150} />
            <AxisBar label={t.axisIndieDepth}   value={p.axisScores.indieDepth}   hue={45} />
            <AxisBar label={t.axisEraBreadth}   value={p.axisScores.eraBreadth}   hue={310} />
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">{t.axisHint}</p>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ChipList title={t.favoriteGenres} items={p.favoriteGenres ?? []} color="bg-indigo-900/60" linkable t={t} />
        <ChipList title={t.avoidedGenres} items={p.avoidedGenres ?? []} color="bg-rose-900/60" linkable t={t} />
        <ChipList title={t.unexploredGenres} items={p.unexploredGenres ?? []} color="bg-amber-900/60" linkable t={t} />
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 className="font-semibold">{t.moodProfile}</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">{p.moodProfile}</p>
      </section>

      {(p.improvementTips?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-900/50 bg-neutral-900 p-6">
          <h3 className="font-semibold text-emerald-300">{t.improvementGuide}</h3>
          <ol className="flex flex-col gap-3">
            {(p.improvementTips ?? []).map((tip, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-neutral-300">
                <span className="shrink-0 font-bold text-emerald-400">{i + 1}</span>
                <span>{tip}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function ChipList({
  title,
  items,
  color,
  linkable,
  t,
}: {
  title: string;
  items: string[];
  color: string;
  linkable?: boolean;
  t: ProfileT;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-400">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-neutral-600">{t.emptyChip}</span>
        ) : (
          items.map((it) =>
            linkable ? (
              <Link
                key={it}
                href={`/genre/${encodeURIComponent(it)}`}
                className={`rounded-md ${color} px-2 py-0.5 text-xs hover:brightness-125`}
              >
                {it}
              </Link>
            ) : (
              <span key={it} className={`rounded-md ${color} px-2 py-0.5 text-xs`}>
                {it}
              </span>
            ),
          )
        )}
      </div>
    </div>
  );
}
