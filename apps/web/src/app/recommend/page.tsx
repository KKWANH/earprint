import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { ModePicker } from "./ModePicker";
import { Tournament, type Rec } from "./Tournament";

/** Maps a stored rec_type (incl. legacy values) to the current union. */
function mapRecType(t: string): Rec["recType"] {
  if (t === "genre") return "genre";
  if (t === "unheard" || t === "explore") return "unheard";
  if (t === "indie") return "indie";
  return "song";
}

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
    recType: mapRecType((r.rec_type as string) ?? "song"),
  }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-2xl font-bold">추천 월드컵</h1>
      <p className="text-sm text-neutral-400">
        추천을 듣고 좋아요/별로로 평가하세요. 좋아요·이미 아는 곡은 라이브러리에
        반영되고, 별로한 아티스트는 다음 추천에서 제외됩니다.
      </p>
      <ModePicker />
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
