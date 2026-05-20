import Link from "next/link";
import { auth, signIn } from "@/auth";
import { ensureConnection, getLibrarySummary } from "@/lib/connection";
import { TokenBox } from "./TokenBox";

export default async function ConnectPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/connect" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            Google 로 로그인하고 시작하기
          </button>
        </form>
      </main>
    );
  }

  const { userId, token } = await ensureConnection();
  const { count, recent } = await getLibrarySummary(userId);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">확장 연결</h1>
        <p className="text-sm text-neutral-400">{session.user.email}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold">동기화 토큰</h2>
        <p className="text-sm text-neutral-400">
          크롬 확장 팝업의 &ldquo;동기화 토큰&rdquo; 칸에 아래 값을 붙여넣으세요.
          백엔드 URL 칸에는 이 사이트 주소를 넣습니다.
        </p>
        <TokenBox token={token} />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">내 라이브러리 — {count}곡</h2>
          <Link
            href="/library"
            className="shrink-0 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-neutral-900"
          >
            분석 대시보드 →
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">
            아직 동기화된 곡이 없습니다. 확장에서 동기화를 실행하세요.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {recent.map((t, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="truncate">{t.title}</span>
                <span className="shrink-0 text-neutral-500">{t.artist}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
