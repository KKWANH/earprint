import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { getGenreMap } from "@/lib/genreMap";
import type { AiProfile, Persona } from "@/lib/profile";
import { getLocale } from "@/lib/i18n-server";
import { profileDict } from "@/lib/i18n/profile";
import { GenerateButton } from "./GenerateButton";
import { GenreConstellation } from "./GenreConstellation";

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
    SELECT ai_profile, ai_generated_at FROM taste_profiles WHERE user_id = ${userId}`;
  const profile = (rows[0]?.ai_profile as AiProfile | undefined) ?? null;
  const generatedAt = rows[0]?.ai_generated_at as string | undefined;
  const genreMap = await getGenreMap(userId);

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
      </section>

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
        <ProfileView profile={profile} t={t} />
      ) : (
        <p className="text-sm text-neutral-500">{t.noProfile}</p>
      )}
    </main>
  );
}

type ProfileT = ReturnType<typeof profileDict>;

function ProfileView({ profile: p, t }: { profile: AiProfile; t: ProfileT }) {
  return (
    <div className="flex flex-col gap-6">
      {p.persona && <PersonaCard persona={p.persona} score={p.diggingScore} t={t} />}

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

function PersonaCard({
  persona,
  score,
  t,
}: {
  persona: Persona;
  score: number;
  t: ProfileT;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/40 via-fuchsia-600/30 to-amber-500/25 p-8 text-center">
      <div className="text-6xl">{persona.emoji}</div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/60">
        {persona.archetype}
      </p>
      <h2 className="mt-1 text-3xl font-extrabold leading-tight">{persona.name}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/80">{persona.tagline}</p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 text-sm">
        <span className="font-bold text-emerald-300">{t.personaScore} {score}</span>
        <span className="text-white/40">/ 100</span>
      </div>
    </section>
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
