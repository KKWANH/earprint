import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default async function LandingPage() {
  const locale = await getLocale();
  const t = getDict(locale).landing;
  const session = await auth();
  const signedIn = !!session?.user;

  const features = [
    { icon: "📊", title: t.f1Title, body: t.f1Body },
    { icon: "🧬", title: t.f2Title, body: t.f2Body },
    { icon: "🗺️", title: t.f3Title, body: t.f3Body },
    { icon: "🎯", title: t.f4Title, body: t.f4Body },
  ];
  const steps = [t.s1, t.s2, t.s3];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-20 px-4 py-14 sm:px-6 sm:py-20">
      {/* hero */}
      <section className="flex flex-col items-center text-center">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-400">
          🎧 YouTube Music · taste analytics
        </span>
        <h1 className="mt-5 bg-gradient-to-br from-white via-white to-emerald-300 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-6xl">
          Playlist Analyzer
        </h1>
        <p className="mt-4 max-w-xl text-lg font-medium text-neutral-200 sm:text-xl">
          {t.tagline}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          {t.intro}
        </p>
        <div className="mt-7">
          {signedIn ? (
            <Link
              href="/library"
              className="inline-block rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              {t.ctaIn}
            </Link>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/library" });
              }}
            >
              <button className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200">
                {t.ctaOut}
              </button>
            </form>
          )}
        </div>
        {signedIn && (
          <p className="mt-3 text-xs text-neutral-500">
            {t.signedInAs} {session!.user!.email}
          </p>
        )}
      </section>

      {/* science */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-fuchsia-600/10 to-transparent p-7 sm:p-10">
        <h2 className="text-xl font-bold sm:text-2xl">{t.scienceTitle}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">
          {t.scienceBody}
        </p>
      </section>

      {/* features */}
      <section className="flex flex-col gap-6">
        <h2 className="text-center text-xl font-bold sm:text-2xl">{t.featuresTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section className="flex flex-col gap-6">
        <h2 className="text-center text-xl font-bold sm:text-2xl">{t.howTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-6"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-black">
                {i + 1}
              </div>
              <p className="text-sm leading-relaxed text-neutral-300">{s}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          {signedIn ? (
            <Link
              href="/connect"
              className="inline-block rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400"
            >
              {t.ctaIn}
            </Link>
          ) : (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/connect" });
              }}
            >
              <button className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200">
                {t.ctaOut}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t border-white/10 pt-6 text-center text-xs text-neutral-600">
        {t.footer}
      </footer>
    </main>
  );
}
