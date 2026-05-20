import { auth } from "@/auth";
import { getSql } from "@/lib/db";

const ADMIN_EMAIL = "kwanho0096@gmail.com";

export default async function AdminPage() {
  const session = await auth();
  if (session?.user?.email !== ADMIN_EMAIL) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-neutral-400">
        접근 권한이 없습니다.
      </main>
    );
  }

  const sql = getSql();
  const stat = await sql`
    SELECT
      (SELECT count(*) FROM users)::int                                          AS users,
      (SELECT count(*) FROM user_tracks)::int                                    AS likes,
      (SELECT count(*) FROM tracks)::int                                         AS tracks,
      (SELECT count(*) FROM analysis)::int                                       AS analyses,
      (SELECT count(*) FROM analysis WHERE genres IS NOT NULL)::int              AS with_genre,
      (SELECT count(*) FROM recommendations)::int                                AS recs,
      (SELECT count(*) FROM recommendations WHERE rating IS NOT NULL)::int        AS rated`;
  const s = stat[0];

  const users = await sql`
    SELECT email, created_at FROM users ORDER BY created_at DESC LIMIT 15`;
  const ratings = await sql`
    SELECT artist, title, rating, comment, rated_at
    FROM recommendations WHERE rating IS NOT NULL
    ORDER BY rated_at DESC LIMIT 15`;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold">어드민</h1>

      <section className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        <Stat label="가입 사용자" value={s.users} />
        <Stat label="좋아요 곡" value={s.likes} />
        <Stat label="고유 트랙" value={s.tracks} />
        <Stat label="분석 레코드" value={s.analyses} />
        <Stat label="장르 보유" value={s.with_genre} />
        <Stat label="생성된 추천" value={s.recs} />
        <Stat label="평가된 추천" value={s.rated} />
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        <strong className="text-neutral-200">접속자 수 · 요청/에러 로그</strong> 는
        Cloudflare 대시보드 → Workers &amp; Pages → playlist-analyzer-web →
        Metrics/Logs 에서 확인하세요. 실시간 로그는{" "}
        <code className="rounded bg-neutral-800 px-1">npx wrangler tail</code>.
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold">최근 가입</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {users.map((u, i) => (
            <li key={i} className="flex justify-between gap-4 text-neutral-400">
              <span className="truncate">{u.email as string}</span>
              <span className="shrink-0 text-neutral-600">
                {new Date(u.created_at as string).toLocaleDateString("ko-KR")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold">최근 추천 평가</h2>
        {ratings.length === 0 ? (
          <p className="text-sm text-neutral-500">아직 평가가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {ratings.map((r, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-8 shrink-0">
                  {r.rating === "like" ? "👍" : r.rating === "dislike" ? "👎" : "⏭"}
                </span>
                <span className="truncate text-neutral-300">
                  {r.artist as string} — {r.title as string}
                </span>
                {r.comment ? (
                  <span className="truncate text-neutral-500">“{r.comment as string}”</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value.toLocaleString()}</div>
    </div>
  );
}
