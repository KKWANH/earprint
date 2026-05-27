import Link from "next/link";
import { auth, signIn } from "@/auth";
import { CHROME_WEB_STORE_URL } from "@/lib/constants";
import { getDict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { ALL_ZODIACS } from "@/lib/musicZodiac";

// Four zodiac signs shown on the landing as concrete examples of the
// archetype output. Picked for genre breadth + visual variety: Aries
// (hip-hop), Virgo (jazz/classical), Capricorn (rock), Pisces (ambient/
// shoegaze). Pulls live from ALL_ZODIACS so any rename / re-archetype
// edit ripples to the landing automatically.
const SHOWCASE_SIGNS = ["aries", "virgo", "capricorn", "pisces"] as const;

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
        <h1 className="mt-5 bg-gradient-to-br from-white to-emerald-300 bg-clip-text text-5xl font-extrabold leading-tight text-transparent sm:text-6xl">
          Earprint
        </h1>
        <p className="mt-4 max-w-xl text-lg font-medium text-neutral-200 sm:text-xl">
          {t.tagline}
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          {t.intro}
        </p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:gap-3">
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
          {/* Secondary CTA — see a finished report before committing to sign-in.
              Promoted from a small text link so the "no commitment" reassurance
              shares the visual weight of the primary auth button. */}
          {!signedIn && (
            <Link
              href="/demo"
              className="inline-block rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/10"
            >
              {t.ctaDemo}
            </Link>
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
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900 p-6 text-center sm:p-8">
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
        <p className="mt-2 max-w-md text-[11px] leading-relaxed text-neutral-500">
          📱 {t.installMobile}
        </p>
      </section>

      {/* artist map showcase — promoted above personas because it's the
          most visually distinctive output and the strongest reason to come
          back to Earprint after the first analysis. Full-width, single
          block on purpose so it reads as a hero feature, not a card. */}
      <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900">
        <div className="grid items-center gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div className="flex flex-col gap-4">
            <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              {t.mapHeroEyebrow}
            </span>
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
              {t.mapHeroTitle}
            </h2>
            <p className="text-sm leading-relaxed text-neutral-300 sm:text-base">
              {t.mapHeroBody}
            </p>
            <Link
              href="/demo"
              className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              {t.mapHeroCta}
            </Link>
          </div>
          <MapPreview />
        </div>
      </section>

      {/* zodiac showcase — replaces the older "Midnight City-Pop Dreamer"
          fictional-persona gallery. Now uses real archetypes from the
          music-zodiac system, so the landing reflects the actual product
          output. Each card pulls live from ALL_ZODIACS — rename a
          blurb in musicZodiac.ts, this updates. */}
      <section className="flex flex-col gap-6">
        <div className="text-center">
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            {t.zodiacHeroEyebrow}
          </span>
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">{t.zodiacHeroTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-400">
            {t.zodiacHeroBody}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SHOWCASE_SIGNS.map((sign) => {
            const z = ALL_ZODIACS.find((zz) => zz.sign === sign)!;
            const name = locale === "ko" ? z.nameKo : z.nameEn;
            const archetype = locale === "ko" ? z.archetypeKo : z.archetypeEn;
            const blurb = locale === "ko" ? z.blurbKo : z.blurbEn;
            return (
              <div
                key={sign}
                className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b from-amber-950/30 via-neutral-950 to-neutral-900 p-5 text-center"
              >
                <span className="font-serif text-5xl leading-none text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.35)]">
                  {z.symbol}
                </span>
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/55">
                  {name}
                </p>
                <h3 className="text-lg font-extrabold leading-tight">{archetype}</h3>
                <p className="text-xs leading-relaxed text-white/65">{blurb}</p>
              </div>
            );
          })}
        </div>
        <div className="text-center">
          <Link
            href="/demo"
            className="text-sm text-amber-300 underline-offset-2 hover:text-amber-200 hover:underline"
          >
            {t.ctaDemo}
          </Link>
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
 * Static preview of the artist map for the landing-page showcase. Not a real
 * render of any user's data — a hand-laid scatter of nodes designed to read
 * as "this is what your taste looks like once it's mapped". Genre-coloured
 * solid circles + dashed "ghost" outlines (suggesting unheard recommendations)
 * + faint similarity edges. Decorative only; the live component lives in
 * /map/ArtistMap.tsx.
 */
function MapPreview() {
  // Hand-tuned positions clustered by colour so the result reads as
  // "communities of related artists" rather than random noise.
  const nodes = [
    { x: 118, y: 78, r: 18, c: "#34d399" }, // emerald cluster (e.g. indie pop)
    { x: 152, y: 58, r: 10, c: "#6ee7b7" },
    { x: 92, y: 112, r: 8, c: "#6ee7b7" },
    { x: 142, y: 108, r: 14, c: "#34d399" },
    { x: 238, y: 138, r: 22, c: "#fbbf24" }, // amber cluster (e.g. pop)
    { x: 212, y: 168, r: 12, c: "#fbbf24" },
    { x: 270, y: 112, r: 10, c: "#fde68a" },
    { x: 338, y: 88, r: 16, c: "#22d3ee" }, // cyan cluster (e.g. electronic)
    { x: 370, y: 66, r: 8, c: "#22d3ee" },
    { x: 314, y: 116, r: 11, c: "#67e8f9" },
    { x: 198, y: 218, r: 14, c: "#c084fc" }, // violet cluster (e.g. K-pop)
    { x: 232, y: 198, r: 9, c: "#c084fc" },
    { x: 390, y: 184, r: 12, c: "#f87171" }, // rose outlier (e.g. hip-hop)
  ];
  // Ghost nodes — represent "unheard related artists" the user could add.
  const ghosts = [
    { x: 180, y: 132, r: 10 },
    { x: 296, y: 174, r: 8 },
    { x: 372, y: 138, r: 9 },
  ];
  // Edges — within-cluster ties (strong) plus a couple of cross-cluster bridges.
  const edges: [number, number][] = [
    [0, 1], [0, 3], [1, 3], [2, 0], [3, 4],
    [4, 5], [4, 6], [4, 7], [4, 10], [5, 10],
    [7, 8], [7, 9], [9, 6], [10, 11], [12, 7],
  ];
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/5 bg-neutral-950/60">
      <svg viewBox="0 0 480 280" className="absolute inset-0 h-full w-full">
        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a]!.x}
            y1={nodes[a]!.y}
            x2={nodes[b]!.x}
            y2={nodes[b]!.y}
            stroke="#ffffff"
            strokeOpacity="0.12"
            strokeWidth="1"
          />
        ))}
        {ghosts.map((g, i) => {
          const nearest = nodes[i * 4 % nodes.length]!;
          return (
            <line
              key={`gh-${i}`}
              x1={g.x}
              y1={g.y}
              x2={nearest.x}
              y2={nearest.y}
              stroke="#ffffff"
              strokeOpacity="0.18"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          );
        })}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.c} fillOpacity="0.9" />
        ))}
        {ghosts.map((g, i) => (
          <circle
            key={`gn-${i}`}
            cx={g.x}
            cy={g.y}
            r={g.r}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.45"
            strokeDasharray="2 2"
          />
        ))}
      </svg>
    </div>
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
