import { auth, signIn } from "@/auth";
import { getLocale } from "@/lib/i18n-server";
import { worldcupDict } from "@/lib/i18n/worldcup";
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
export default async function CreateCommunityWorldcup({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const locale = await getLocale();
  const t = worldcupDict(locale);
  const session = await auth();
  // R28c — optional `?tag=` pre-seed (linked from /genre/[name]).
  // Whitelisted to short lowercase tokens to avoid an injection
  // surface; we don't want a crafted URL to dump arbitrary content
  // into the tag input.
  const { tag: rawTag } = await searchParams;
  const initialTag =
    rawTag && /^[a-z0-9 _-]{1,40}$/i.test(rawTag.trim())
      ? rawTag.toLowerCase().trim()
      : "";
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
          {t.createPageTitle}
        </h1>
        <p className="text-sm text-neutral-400">
          {t.createPageIntro}
        </p>
      </header>
      <CreateForm locale={locale} initialTag={initialTag} />
    </main>
  );
}
