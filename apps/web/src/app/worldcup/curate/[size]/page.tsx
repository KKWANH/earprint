import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth, signIn } from "@/auth";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
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
  const t = worldcupDict(locale);

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
            {t.curateSignIn}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <Link href="/worldcup" className="text-xs text-neutral-500 hover:text-white">
          ← {t.curateHome}
        </Link>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          {t.curateBracketTitle(size)}
        </h1>
        <p className="text-sm text-neutral-400">
          {t.curateIntro}
        </p>
      </header>
      <CurateForm size={size as 4 | 8 | 16 | 32} locale={locale} />
    </main>
  );
}
