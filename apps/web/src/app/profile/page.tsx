import Link from "next/link";
import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import type { AiProfile } from "@/lib/profile";
import { GenerateButton } from "./GenerateButton";

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

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">AI 음악 심리분석</h1>
        <Link href="/library" className="text-sm text-neutral-400 hover:text-white">
          ← 라이브러리 분석
        </Link>
      </header>

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

      {profile ? (
        <ProfileView profile={profile} />
      ) : (
        <p className="text-sm text-neutral-500">
          아직 분석이 없습니다. 위 버튼으로 생성하세요. (라이브러리 분석을 먼저 돌리면
          장르·무드 데이터가 채워져 더 정확합니다.)
        </p>
      )}
    </main>
  );
}

function ProfileView({ profile: p }: { profile: AiProfile }) {
  return (
    <div className="flex flex-col gap-6">
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
