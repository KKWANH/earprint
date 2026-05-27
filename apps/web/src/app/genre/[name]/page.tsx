import type { Metadata } from "next";
import Link from "next/link";
import { BackLink } from "./BackLink";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getGenreDetail } from "@/lib/genreDetail";
import { genreHue } from "@/lib/forceGraph";
import { getLocale } from "@/lib/i18n-server";
import { genreDict } from "@/lib/i18n/genre";
import { PreviewButton } from "../../library/PreviewButton";
import { AboutBox } from "./AboutBox";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  return { title: `${decodeURIComponent(name)} — Earprint` };
}

/** Shared genre detail page — reachable from the library and artist pages. */
export default async function GenrePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = genreDict(locale);

  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: `/genre/${raw}` });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await requireOnboarded();
  const d = await getGenreDetail(userId, name);
  const hue = genreHue(name);
  const description = locale === "ko" ? d.descriptionKo : d.descriptionEn;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <BackLink label={t.back} fallbackHref="/library" />
        <Link href="/genres" className="text-xs text-neutral-500 hover:text-white">
          {t.allGenres}
        </Link>
      </div>

      {/* coloured genre banner */}
      <header
        className="flex flex-col gap-3 rounded-2xl border border-white/10 p-7"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 55% 24%) 0%, hsl(${
            (hue + 50) % 360
          } 45% 12%) 100%)`,
        }}
      >
        <h1 className="text-2xl font-extrabold capitalize leading-tight sm:text-3xl">
          {d.name}
        </h1>
        <div>
          {d.inLibrary ? (
            <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white">
              ♪ {t.inLibrary(d.userTrackCount)}
            </span>
          ) : (
            <span className="rounded-full bg-black/40 px-3 py-1 text-xs font-medium text-white/70">
              {t.notInLibrary}
            </span>
          )}
        </div>
      </header>

      <Section title={t.about}>
        <AboutBox
          name={d.name}
          initial={description}
          locale={locale}
          emptyText={t.aboutEmpty}
          warmingText={t.aboutWarming ?? t.aboutEmpty}
        />
      </Section>

      {d.topArtists.length > 0 && (
        <Section title={t.topArtists}>
          <div className="flex flex-wrap gap-1.5">
            {d.topArtists.map((a) => (
              <Link
                key={a}
                href={`/artist/${encodeURIComponent(a)}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 hover:border-emerald-500/50 hover:text-white"
              >
                {a}
              </Link>
            ))}
          </div>
        </Section>
      )}

      {d.topTracks.length > 0 && (
        <Section title={t.topTracks}>
          <div className="flex flex-col gap-1">
            {d.topTracks.map((tr, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 border-b border-neutral-800/60 py-1.5 text-sm last:border-0"
              >
                <span className="truncate">{tr.title}</span>
                <Link
                  href={`/artist/${encodeURIComponent(tr.artist)}`}
                  className="ml-auto shrink-0 text-xs text-neutral-500 hover:text-white hover:underline"
                >
                  {tr.artist}
                </Link>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.userTracks.length > 0 && (
        <Section title={t.yourTracks}>
          <div className="flex flex-col gap-1">
            {d.userTracks.map((tr, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border-b border-neutral-800/60 py-1.5 text-sm last:border-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  {tr.title}
                  <span className="text-neutral-500"> · {tr.artist}</span>
                </span>
                <PreviewButton deezerId={tr.deezerId} locale={locale} />
              </div>
            ))}
          </div>
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
