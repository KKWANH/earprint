import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { getGenreMap } from "@/lib/genreMap";
import type { AiProfile, Persona } from "@/lib/profile";
import { GenerateButton } from "./GenerateButton";
import { GenreConstellation } from "./GenreConstellation";

export default async function ProfilePage() {
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
            Google 로 로그인
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
      <h1 className="text-2xl font-bold">AI 음악 심리분석</h1>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <p className="text-sm text-neutral-400">
          좋아요 라이브러리의 장르·무드·아티스트 분포를 Gemini 가 해석해 취향·성격을
          프로파일링합니다. 분석을 더 돌릴수록 정확해집니다.
        </p>
        <GenerateButton hasProfile={!!profile} />
        {generatedAt && (
          <p className="text-xs text-neutral-500">
            생성: {new Date(generatedAt).toLocaleString("ko-KR")}
          </p>
        )}
      </section>

      {genreMap.nodes.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <div>
            <h2 className="font-semibold">취향 별자리</h2>
            <p className="text-sm text-neutral-400">
              장르를 별로, 같은 곡에 함께 태그된 장르를 선으로 잇습니다. 자주 섞어
              듣는 장르일수록 가까이 모입니다.
            </p>
          </div>
          <GenreConstellation data={genreMap} />
        </section>
      )}

      {profile ? (
        <ProfileView profile={profile} />
      ) : (
        <p className="text-sm text-neutral-500">
          아직 AI 분석이 없습니다. 위 버튼으로 생성하세요. (라이브러리 분석을 먼저
          돌리면 장르·무드 데이터가 채워져 더 정확합니다.)
        </p>
      )}
    </main>
  );
}

function ProfileView({ profile: p }: { profile: AiProfile }) {
  return (
    <div className="flex flex-col gap-6">
      {p.persona && <PersonaCard persona={p.persona} score={p.diggingScore} />}

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
          <div className="text-xs text-neutral-500">디깅 점수</div>
        </div>
        <p className="flex-1 text-sm text-neutral-300">{p.diggingComment}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <ChipList title="좋아하는 장르" items={p.favoriteGenres ?? []} color="bg-indigo-900/60" />
        <ChipList title="피하는 장르" items={p.avoidedGenres ?? []} color="bg-rose-900/60" />
        <ChipList title="안 들어본 장르" items={p.unexploredGenres ?? []} color="bg-amber-900/60" />
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 className="font-semibold">무드 프로파일</h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">{p.moodProfile}</p>
      </section>

      {(p.improvementTips?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-emerald-900/50 bg-neutral-900 p-6">
          <h3 className="font-semibold text-emerald-300">취향 보강 가이드</h3>
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

function PersonaCard({ persona, score }: { persona: Persona; score: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/40 via-fuchsia-600/30 to-amber-500/25 p-8 text-center">
      <div className="text-6xl">{persona.emoji}</div>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/60">
        {persona.archetype}
      </p>
      <h2 className="mt-1 text-3xl font-extrabold leading-tight">{persona.name}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/80">{persona.tagline}</p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 text-sm">
        <span className="font-bold text-emerald-300">디깅 {score}</span>
        <span className="text-white/40">/ 100</span>
      </div>
    </section>
  );
}

function ChipList({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h3 className="text-sm font-semibold text-neutral-400">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <span className="text-xs text-neutral-600">—</span>
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
