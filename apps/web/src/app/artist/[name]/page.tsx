import Link from "next/link";
import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getArtistDetail } from "@/lib/artistDetail";
import { getLocale } from "@/lib/i18n-server";
import { artistDict } from "@/lib/i18n/artist";
import { PreviewButton } from "../../library/PreviewButton";
import { ArtistActions } from "./ArtistActions";

/** Shared artist detail page — reachable from the library, map and recommendations. */
export default async function ArtistPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const locale = await getLocale();
  const t = artistDict(locale);

  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: `/artist/${raw}` });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            Sign in with Google
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await ensureConnection();
  const d = await getArtistDetail(userId, name);

  // Group the liked tracks by album, keeping the album-frequency order.
  const byAlbum = new Map<string, typeof d.tracks>();
  for (const tr of d.tracks) {
    const key = tr.album ?? "";
    if (!byAlbum.has(key)) byAlbum.set(key, []);
    byAlbum.get(key)!.push(tr);
  }
  const albumOrder = [...d.albums.map((a) => a.name), ""].filter(
    (k, i, arr) => byAlbum.has(k) && arr.indexOf(k) === i,
  );

  const feel = d.audioFeel;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/library" className="text-xs text-neutral-500 hover:text-white">
        {t.back}
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-extrabold leading-tight">{d.name}</h1>
        <div>
          {d.inLibrary ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              ♪ {t.inLibrary(d.trackCount)}
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
              {t.notInLibrary}
            </span>
          )}
        </div>
        <ArtistActions
          name={d.name}
          inLibrary={d.inLibrary}
          affinity={d.affinity}
          locale={locale}
        />
      </header>

      {d.genres.length > 0 && (
        <Section title={t.genres}>
          <div className="flex flex-wrap gap-1.5">
            {d.genres.map((g) => (
              <span key={g.name} className="rounded-full bg-indigo-900/60 px-2.5 py-1 text-xs">
                {g.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {d.moods.length > 0 && (
        <Section title={t.moods}>
          <div className="flex flex-wrap gap-1.5">
            {d.moods.map((m) => (
              <span key={m.name} className="rounded-full bg-rose-900/60 px-2.5 py-1 text-xs">
                {m.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {feel && (
        <Section title={t.audioFeel}>
          <div className="flex flex-col gap-2">
            {[
              { label: t.feelEnergy, v: feel.energy },
              { label: t.feelTempo, v: feel.tempo },
              { label: t.feelAcoustic, v: feel.acousticness },
            ].map((a) => (
              <div key={a.label} className="flex items-center gap-3 text-xs">
                <span className="w-16 shrink-0 text-neutral-400">{a.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${Math.round(a.v * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-neutral-500">
                  {Math.round(a.v * 100)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {d.tracks.length > 0 && (
        <Section title={t.tracks}>
          <div className="flex flex-col gap-4">
            {albumOrder.map((al) => (
              <div key={al || "_"} className="flex flex-col gap-1">
                <p className="text-xs font-medium text-neutral-500">{al || t.albumNone}</p>
                {byAlbum.get(al)!.map((tr, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 border-b border-neutral-800/60 py-1.5 text-sm last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate">{tr.title}</span>
                    <PreviewButton deezerId={tr.deezerId} locale={locale} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={t.related}>
        {d.related.length === 0 ? (
          <p className="text-sm text-neutral-600">{t.relatedEmpty}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {d.related.map((r) => (
              <Link
                key={r}
                href={`/artist/${encodeURIComponent(r)}`}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300 hover:border-emerald-500/50 hover:text-white"
              >
                {r}
              </Link>
            ))}
          </div>
        )}
      </Section>
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
