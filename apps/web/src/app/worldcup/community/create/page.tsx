import { auth, signIn } from "@/auth";
import { getLocale } from "@/lib/i18n-server";
import { CreateForm } from "./CreateForm";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Make a worldcup — Earprint" };
}

/**
 * /worldcup/community/create — sign-in gate + the form. The form
 * itself is a client component because it manages a dynamic list of
 * YouTube URLs with add/remove rows; the page wrapper just decides
 * whether to show it.
 */
export default async function CreateCommunityWorldcup() {
  const locale = await getLocale();
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1 className="mb-4 text-xl font-bold">Sign in to make a worldcup</h1>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/worldcup/community/create" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {locale === "ko" ? "월드컵 만들기" : "Make a worldcup"}
        </h1>
        <p className="text-sm text-neutral-400">
          {locale === "ko"
            ? "YouTube 영상 URL 을 4 / 8 / 16 / 32 개 입력해 토너먼트를 만드세요. 만들면 누구든지 플레이할 수 있고, 결과 통계가 쌓입니다."
            : "Paste 4 / 8 / 16 / 32 YouTube URLs to compose a tournament. Once published, anyone can play it and the win-rate stats stack up."}
        </p>
      </header>
      <CreateForm locale={locale} />
    </main>
  );
}
