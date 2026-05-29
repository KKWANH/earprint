import type { Metadata } from "next";
import { auth, signIn } from "@/auth";
import { requireOnboarded } from "@/lib/onboarding";
import { getSql } from "@/lib/db";
import { getLocale } from "@/lib/i18n-server";
import { recommendDict } from "@/lib/i18n/recommend";
import { ModePicker } from "./ModePicker";
import { Tournament, type Rec } from "./Tournament";

export async function generateMetadata(): Promise<Metadata> {
  const t = recommendDict(await getLocale());
  return { title: `${t.pageTitle} — Earprint` };
}

/** Maps a stored rec_type (incl. legacy values) to the current union. */
function mapRecType(t: string): Rec["recType"] {
  if (t === "genre") return "genre";
  if (t === "unheard" || t === "explore") return "unheard";
  if (t === "indie") return "indie";
  return "song";
}

export default async function RecommendPage() {
  const locale = await getLocale();
  const t = recommendDict(locale);
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/recommend" });
          }}
        >
          <button className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900">
            {t.loginGoogle}
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await requireOnboarded();
  const sql = getSql();

  const [unrated, stat, perMode] = await Promise.all([
    sql`
      SELECT id, artist, title, album, cover_url, deezer_id, seed_track,
             score, rec_type, blurb AS description
      FROM recommendations
      WHERE user_id = ${userId} AND rating IS NULL
      ORDER BY created_at DESC
      LIMIT 20`,
    sql`
      SELECT count(*) FILTER (WHERE rating = 'like')::int     AS likes,
             count(*) FILTER (WHERE rating = 'dislike')::int  AS dislikes,
             count(*) FILTER (WHERE rating IS NOT NULL)::int  AS rated
      FROM recommendations WHERE user_id = ${userId}`,
    // R30d — per-mode quality breakdown. Like / dislike ratios by
    // rec_type so the user can see which recommendation flavour
    // works best for them and pick more from that mode.
    sql`
      SELECT rec_type,
             count(*) FILTER (WHERE rating IS NOT NULL)::int AS rated,
             count(*) FILTER (WHERE rating IN ('like', 'superlike'))::int AS likes,
             count(*) FILTER (WHERE rating IN ('dislike', 'strong_dislike'))::int AS dislikes
      FROM recommendations
      WHERE user_id = ${userId} AND rating IS NOT NULL
      GROUP BY rec_type`,
  ]);

  const recs: Rec[] = unrated.map((r) => ({
    id: r.id as string,
    artist: r.artist as string,
    title: r.title as string,
    album: (r.album as string) ?? null,
    coverUrl: (r.cover_url as string) ?? null,
    deezerId: (r.deezer_id as number) ?? null,
    seedTrack: (r.seed_track as string) ?? null,
    score: (r.score as number) ?? null,
    recType: mapRecType((r.rec_type as string) ?? "song"),
    description: (r.description as string) ?? null,
  }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
      <p className="text-sm text-neutral-400">{t.pageIntro}</p>

      {/* R30d — recommendation quality breakdown by mode. Surfaces
          which flavour works best for this user. Hidden when no
          ratings exist yet (rated=0) since the percentages would
          be meaningless. */}
      {stat[0].rated > 0 && perMode.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-emerald-200">
              {locale === "ko" ? "🎯 모드별 정확도" : "🎯 Mode accuracy"}
            </h2>
            <span className="text-[11px] text-neutral-500">
              {locale === "ko"
                ? `평가 ${stat[0].rated}건 · 👍 ${stat[0].likes} · 👎 ${stat[0].dislikes}`
                : `${stat[0].rated} rated · 👍 ${stat[0].likes} · 👎 ${stat[0].dislikes}`}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {perMode
              .slice()
              .sort((a, b) => {
                const ar = (a.likes as number) / Math.max(1, a.rated as number);
                const br = (b.likes as number) / Math.max(1, b.rated as number);
                return br - ar;
              })
              .map((r) => {
                const rated = Number(r.rated ?? 0);
                const likes = Number(r.likes ?? 0);
                const pct = rated > 0 ? Math.round((likes / rated) * 100) : 0;
                const label = String(r.rec_type ?? "—");
                return (
                  <div key={label} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 capitalize text-neutral-300">
                      {label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-neutral-400">
                      {likes}/{rated} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <ModePicker locale={locale} currentMode={recs[0]?.recType ?? null} />
      <Tournament
        key={recs[0]?.id ?? "empty"}
        locale={locale}
        initial={recs}
        rated={stat[0].rated}
        likes={stat[0].likes}
        dislikes={stat[0].dislikes}
      />
    </main>
  );
}
