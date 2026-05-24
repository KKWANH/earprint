import Link from "next/link";
import { auth, signIn } from "@/auth";
import { CHROME_WEB_STORE_URL } from "@/lib/constants";
import { getDict, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { PersonaCard } from "@/components/PersonaCard";

/** Illustrative personas for the landing-page gallery (not real users). */
const SAMPLE_PERSONAS: Record<
  Locale,
  { persona: { emoji: string; archetype: string; name: string; tagline: string }; score: number; percentile: number | null }[]
> = {
  en: [
    {
      persona: {
        emoji: "🌃",
        archetype: "City-pop dreamer",
        name: "Midnight City-Pop Dreamer",
        tagline: "Neon-lit nostalgia on a late-night drive.",
      },
      score: 78,
      percentile: 14,
    },
    {
      persona: {
        emoji: "🌫️",
        archetype: "Shoegaze romantic",
        name: "Reverb-Drenched Romantic",
        tagline: "Feelings turned all the way up, vocals all the way down.",
      },
      score: 86,
      percentile: 6,
    },
    {
      persona: {
        emoji: "🎐",
        archetype: "Lo-fi wanderer",
        name: "Lo-fi Afternoon Wanderer",
        tagline: "Soft beats for a slow, unhurried world.",
      },
      score: 61,
      percentile: null,
    },
  ],
  ko: [
    {
      persona: {
        emoji: "🌃",
        archetype: "시티팝 드리머",
        name: "심야의 시티팝 드리머",
        tagline: "네온 불빛 아래 늦은 밤 드라이브의 노스탤지어.",
      },
      score: 78,
      percentile: 14,
    },
    {
      persona: {
        emoji: "🌫️",
        archetype: "슈게이즈 로맨티스트",
        name: "리버브에 잠긴 로맨티스트",
        tagline: "감정은 끝까지 올리고, 보컬은 안개 속으로.",
      },
      score: 86,
      percentile: 6,
    },
    {
      persona: {
        emoji: "🎐",
        archetype: "로파이 방랑자",
        name: "로파이 오후의 산책자",
        tagline: "느리고 여유로운 세계를 위한 부드러운 비트.",
      },
      score: 61,
      percentile: null,
    },
  ],
};

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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-12 sm:gap-20 sm:px-6 sm:py-20">
      {/* hero */}
      <section className="flex flex-col items-center text-center">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-400">
          🎧 YouTube Music · taste analytics
        </span>
        <h1 className="mt-5 bg-gradient-to-br from-white to-emerald-300 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-6xl">
          Earprint
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

      {/* Chrome Web Store install card — primary funnel since the extension
          is the only way liked songs reach Earprint. */}
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900 p-8 text-center">
        <div className="flex items-center gap-2 text-2xl" aria-hidden>
          <span>🧩</span>
        </div>
        <h2 className="text-xl font-bold sm:text-2xl">{t.installTitle}</h2>
        <p className="max-w-md text-sm leading-relaxed text-neutral-400">
          {t.installSubtitle}
        </p>
        <a
          href={CHROME_WEB_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
        >
          <ChromeMark />
          {t.installCta}
        </a>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-neutral-500">{t.installNote}</span>
          <Link
            href="/guide"
            className="text-xs text-neutral-400 underline-offset-2 hover:text-white hover:underline"
          >
            {t.installGuide}
          </Link>
        </div>
      </section>

      {/* sample persona gallery */}
      <section className="flex flex-col gap-6">
        <div className="text-center">
          <h2 className="text-xl font-bold sm:text-2xl">{t.galleryTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
            {t.gallerySubtitle}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {SAMPLE_PERSONAS[locale].map((s) => (
            <PersonaCard
              key={s.persona.name}
              persona={s.persona}
              score={s.score}
              percentile={s.percentile}
              locale={locale}
            />
          ))}
        </div>
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
        <div className="flex flex-col items-center gap-3">
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
          <Link
            href="/guide"
            className="text-xs text-neutral-500 underline-offset-2 hover:text-white hover:underline"
          >
            {t.installGuide}
          </Link>
        </div>
      </section>

    </main>
  );
}

/**
 * Simplified Chrome mark for the install button — three-colour outer ring +
 * blue centre. Recognisable at 16px without the path complexity of the
 * official mark.
 */
function ChromeMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#fff" />
      <path d="M12 1 a11 11 0 0 1 9.5 5.5 H12 z" fill="#EA4335" />
      <path d="M2.5 6.5 A11 11 0 0 0 7.5 21 L12 13 H2.5 z" fill="#FBBC05" />
      <path d="M7.5 21 A11 11 0 0 0 21.5 17.5 L17 13 z" fill="#34A853" />
      <circle cx="12" cy="12" r="4.5" fill="#4285F4" />
    </svg>
  );
}
