import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/constants";
import { getSql } from "@/lib/db";
import { AlphaTuner } from "./AlphaTuner";

async function requireAdmin() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) throw new Error("forbidden");
}

/** Adds an email to the Gemini-cap whitelist. */
async function addWhitelist(formData: FormData) {
  "use server";
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  await getSql()`
    INSERT INTO app_whitelist (email) VALUES (${email}) ON CONFLICT DO NOTHING`;
  revalidatePath("/admin");
}

/** Removes an email from the whitelist. */
async function removeWhitelist(formData: FormData) {
  "use server";
  await requireAdmin();
  const email = String(formData.get("email") ?? "");
  await getSql()`DELETE FROM app_whitelist WHERE email = ${email}`;
  revalidatePath("/admin");
}

export default async function AdminPage() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20 text-neutral-400">
        접근 권한이 없습니다.
      </main>
    );
  }

  const sql = getSql();
  const settingsRows = await sql`
    SELECT recency_alpha, updated_at FROM app_settings WHERE id = 1`;
  const alpha = (settingsRows[0]?.recency_alpha as number) ?? 1.0;
  const alphaUpdatedAt =
    settingsRows[0]?.updated_at instanceof Date
      ? (settingsRows[0].updated_at as Date).toISOString()
      : String(settingsRows[0]?.updated_at ?? "");
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
  const whitelist = await sql`
    SELECT email, added_at FROM app_whitelist ORDER BY added_at`;
  const usageRows = await sql`
    SELECT count FROM api_usage WHERE day = current_date AND kind = 'gemini'`;
  const geminiToday = usageRows.length > 0 ? (usageRows[0].count as number) : 0;

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

      <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <div>
          <h2 className="font-semibold">Recency α (취향 가중치 곡선)</h2>
          <p className="mt-1 text-sm text-neutral-400">
            최근 좋아요에 얼마나 가중치를 줄지. 0 = 비활성 (전 트랙 동일),
            1 = 기본 (newest=2×, oldest=1×), 2 = 더 강함 (newest=3×). 3 이상은
            오래된 좋아요를 거의 무시합니다.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            마지막 변경: {alphaUpdatedAt || "—"}
          </p>
        </div>
        <AlphaTuner initial={alpha} />
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        <strong className="text-neutral-200">접속자 수 · 요청/에러 로그</strong> 는
        Cloudflare 대시보드 → Workers &amp; Pages → playlist-analyzer-web →
        Metrics/Logs 에서 확인하세요. 실시간 로그는{" "}
        <code className="rounded bg-neutral-800 px-1">npx wrangler tail</code>.
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold">
          화이트리스트{" "}
          <span className="text-xs font-normal text-neutral-500">
            · Gemini 일일 캡 무시 · 오늘 호출 {geminiToday.toLocaleString()}회
          </span>
        </h2>
        <form action={addWhitelist} className="flex gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="email@example.com"
            className="flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none focus:border-emerald-500/60"
          />
          <button className="shrink-0 rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-medium text-black">
            추가
          </button>
        </form>
        <ul className="flex flex-col gap-1 text-sm">
          {whitelist.length === 0 ? (
            <li className="text-neutral-600">비어 있음 — 본인 이메일을 추가하세요.</li>
          ) : (
            whitelist.map((w, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span className="truncate text-neutral-300">{w.email as string}</span>
                <form action={removeWhitelist}>
                  <input type="hidden" name="email" value={w.email as string} />
                  <button className="shrink-0 text-xs text-neutral-500 hover:text-rose-400">
                    삭제
                  </button>
                </form>
              </li>
            ))
          )}
        </ul>
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
