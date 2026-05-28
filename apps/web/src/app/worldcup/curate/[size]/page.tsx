import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth, signIn } from "@/auth";
import { getLocale } from "@/lib/i18n-server";
import { CurateForm } from "./CurateForm";

const ALLOWED_SIZES = new Set([4, 8, 16, 32]);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ size: string }>;
}): Promise<Metadata> {
  const { size } = await params;
  return { title: `Curated ${size}-bracket — Earprint` };
}

/**
 * /worldcup/curate/[size] — lens picker for the AI-curated worldcup
 * (Track A of the roadmap). User picks a mood/lens, server calls
 * Gemini to compose a bracket of that size from their library, then
 * hands off to the standard Bracket runner.
 *
 * Sign-in required because the curation reads the user's library;
 * URL is shareable but only works for the owner of it (anyone else
 * lands on their own /curate flow).
 */
export default async function CuratePage({
  params,
}: {
  params: Promise<{ size: string }>;
}) {
  const { size: sizeStr } = await params;
  const size = Number(sizeStr);
  if (!ALLOWED_SIZES.has(size)) notFound();

  const locale = await getLocale();
  const ko = locale === "ko";

  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: `/worldcup/curate/${size}` });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {ko ? "Google 로 로그인" : "Sign in with Google"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <Link href="/worldcup" className="text-xs text-neutral-500 hover:text-white">
          ← {ko ? "월드컵 홈" : "Worldcup home"}
        </Link>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          {ko ? `AI 큐레이션 ${size}강` : `AI-curated ${size}-bracket`}
        </h1>
        <p className="text-sm text-neutral-400">
          {ko
            ? "라이브러리에서 분위기에 맞는 곡을 AI 가 골라 토너먼트를 만들어줍니다. 렌즈를 고르거나 직접 적어보세요."
            : "Pick a lens (or write your own) and AI selects matching tracks from your library to compose the bracket."}
        </p>
      </header>
      <CurateForm size={size as 4 | 8 | 16 | 32} locale={locale} />
    </main>
  );
}
