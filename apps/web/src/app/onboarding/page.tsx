import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getLocale } from "@/lib/i18n-server";
import { onboardingDict } from "@/lib/i18n/onboarding";
import { OnboardingForm } from "./OnboardingForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = onboardingDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/**
 * One-time consent gate after first sign-in (and after any ToS-version
 * bump). Already-onboarded users get redirected to /library so refreshing
 * the URL doesn't re-prompt them.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = await getLocale();
  const t = onboardingDict(locale);
  const session = await auth();
  if (!session?.user) redirect("/");

  const conn = await ensureConnection();
  if (conn.onboarded) redirect("/library");

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t.pageTitle}</h1>
        <p className="text-sm leading-relaxed text-neutral-400">{t.intro}</p>
      </header>

      <OnboardingForm locale={locale} errored={error === "required"} />

      <footer className="flex flex-col items-start gap-2 border-t border-white/5 pt-4">
        <p className="text-xs text-neutral-500">{t.declineNote}</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5 hover:text-white">
            {t.signOut}
          </button>
        </form>
      </footer>
    </main>
  );
}
