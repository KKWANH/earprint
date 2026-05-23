import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { getGenreMap } from "@/lib/genreMap";
import { getLibraryStats, type AudioFeelAgg, type LibraryStats } from "@/lib/library";
import type { AiProfile } from "@/lib/profile";
import type { Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { profileDict } from "@/lib/i18n/profile";
import { diggingPercentile, newShareId } from "@/lib/share";
import { getMusicZodiac, type MusicZodiac } from "@/lib/musicZodiac";
import { MusicZodiacCard } from "@/components/MusicZodiacCard";
import { GenerateButton } from "./GenerateButton";
import { GenreConstellation } from "./GenreConstellation";
import { ShareButton } from "./ShareButton";

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

  const { userId } = await ensureConnection();
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

  const [genreMap, stats, percentile] = await Promise.all([
    getGenreMap(userId),
    getLibraryStats(userId),
    profile ? diggingPercentile(profile.diggingScore) : Promise.resolve(null),
  ]);
  const zodiac = getMusicZodiac(stats);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold">{t.pageTitle}</h1>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-sm text-neutral-400">{t.introText}</p>
        <GenerateButton hasProfile={!!profile} locale={locale} />
        {generatedAt && (
          <p className="text-xs text-neutral-500">
            {t.generatedAt} {new Date(generatedAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
          </p>
        )}
        {staleLocale && (
          <p className="text-xs text-amber-400">{t.localeMismatch}</p>
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      <section className="flex items-center gap-5 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex flex-col items-center">
          <div className="text-4xl font-bold text-emerald-400">{p.diggingScore}</div>
          <div className="text-xs text-neutral-500">{t.diggingScore}</div>
          {percentile != null && (
            <div className="mt-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
              {t.topPercent(percentile)}
            </div>
          )}
        </div>
        <p className="flex-1 text-sm text-neutral-300">{p.diggingComment}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ChipList title={t.favoriteGenres} items={p.favoriteGenres ?? []} color="bg-indigo-900/60" t={t} />
        <ChipList title={t.avoidedGenres} items={p.avoidedGenres ?? []} color="bg-rose-900/60" t={t} />
        <ChipList title={t.unexploredGenres} items={p.unexploredGenres ?? []} color="bg-amber-900/60" t={t} />
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
  t,
}: {
  title: string;
  items: string[];
  color: string;
  t: ProfileT;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-400">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-neutral-600">{t.emptyChip}</span>
        ) : (
          items.map((it) => (
            <span key={it} className={`rounded-md ${color} px-2 py-0.5 text-xs`}>
              {it}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
