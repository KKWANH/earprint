import Link from "next/link";
import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { Tournament, type Rec } from "./Tournament";

export default async function RecommendPage() {
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
            Google 로 로그인
          </button>
        </form>
      </main>
    );
  }

  const { userId } = await ensureConnection();
  const sql = getSql();

  const [unrated, stat] = await Promise.all([
    sql`
      SELECT id, artist, title, album, cover_url, deezer_id, seed_track, score, blurb, rec_type
      FROM recommendations
      WHERE user_id = ${userId} AND rating IS NULL
      ORDER BY created_at
      LIMIT 20`,
    sql`
      SELECT count(*) FILTER (WHERE rating = 'like')::int     AS likes,
             count(*) FILTER (WHERE rating = 'dislike')::int  AS dislikes,
             count(*) FILTER (WHERE rating IS NOT NULL)::int  AS rated
      FROM recommendations WHERE user_id = ${userId}`,
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
    blurb: (r.blurb as string) ?? null,
    recType: (r.rec_type as string) === "explore" ? "explore" : "similar",
  }));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">추천 월드컵</h1>
        <nav className="flex gap-4 text-sm text-neutral-400">
          <Link href="/library" className="hover:text-white">
            라이브러리
          </Link>
          <Link href="/profile" className="hover:text-white">
            심리분석
          </Link>
        </nav>
      </header>
      <p className="text-sm text-neutral-400">
        좋아요 라이브러리에서 파생된 추천을 듣고 좋아요/별로로 평가하세요. 평가는 다음
        추천에 반영됩니다 (별로한 아티스트는 제외).
      </p>
      <Tournament
        key={recs[0]?.id ?? "empty"}
        initial={recs}
        rated={stat[0].rated}
        likes={stat[0].likes}
        dislikes={stat[0].dislikes}
      />
    </main>
  );
}
