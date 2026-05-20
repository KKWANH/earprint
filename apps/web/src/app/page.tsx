import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Playlist Analyzer</h1>
        <p className="text-neutral-400">
          유튜브 뮤직 좋아요 곡을 분석해 music-map 과 추천을 제공합니다.
        </p>
      </header>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        {session?.user ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm">
                로그인됨: <strong>{session.user.email}</strong>
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm">
                  로그아웃
                </button>
              </form>
            </div>
            <Link
              href="/connect"
              className="rounded-md bg-white px-4 py-2 text-center text-sm font-medium text-neutral-900"
            >
              확장 연결 · 라이브러리 보기
            </Link>
          </div>
        ) : (
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/connect" });
            }}
          >
            <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
              Google 로 로그인
            </button>
          </form>
        )}
      </section>

      <p className="text-xs text-neutral-500">
        Phase 1 — 확장이 좋아요 곡을 수집해 백엔드에 저장합니다.
      </p>
    </main>
  );
}
