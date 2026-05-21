import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getImprintAnalysis, type ImprintAnalysis } from "@/lib/imprint";
import { getNoveltyIndex, type NoveltyIndex } from "@/lib/novelty";
import { BirthYearInput } from "./BirthYearInput";
import { YearBackfill } from "./YearBackfill";

export const metadata = { title: "취향 DNA — Playlist Analyzer" };

export default async function DnaPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dna" });
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
  const [imprint, novelty] = await Promise.all([
    getImprintAnalysis(userId),
    getNoveltyIndex(userId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <h1 className="text-2xl font-bold">취향 DNA</h1>
        <p className="text-sm text-neutral-400">
          당신이 <em>무엇을</em> 듣는지가 아니라, <em>왜</em> 좋아하고 음악 인생의
          어디쯤에 있는지를 봅니다.
        </p>
      </header>

      <ImprintSection a={imprint} />
      <NoveltySection n={novelty} />

      <p className="text-[11px] leading-relaxed text-neutral-600">
        근거 연구 · 회상 융기:{" "}
        <a
          className="underline hover:text-neutral-400"
          href="https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1472767/full"
        >
          Frontiers in Psychology (2024)
        </a>
        {" · "}예측과 보상:{" "}
        <a
          className="underline hover:text-neutral-400"
          href="https://www.jneurosci.org/content/39/47/9397"
        >
          Gold et al., J. Neuroscience (2019)
        </a>
        {" · "}
        <a
          className="underline hover:text-neutral-400"
          href="https://www.nature.com/articles/nn.2726"
        >
          Salimpoor et al., Nature Neuroscience (2011)
        </a>
        {" · "}취향과 성격:{" "}
        <a
          className="underline hover:text-neutral-400"
          href="https://gosling.psy.utexas.edu/wp-content/uploads/2014/09/JPSP03musicdimensions.pdf"
        >
          Rentfrow &amp; Gosling (2003)
        </a>
      </p>
    </main>
  );
}

/* ─────────────────────────  Pillar B — Imprint  ───────────────────────── */

const STAGE_TEXT: Record<ImprintAnalysis["stage"], { title: string; body: string }> = {
  digging: {
    title: "현재진행형 디깅형",
    body: "최근 음악의 비중이 높습니다. 발견 욕구(개방성)가 여전히 강한 패턴 — 나이와 무관하게 새 사운드를 계속 탐색하는 취향입니다.",
  },
  imprint: {
    title: "각인형",
    body: "10대 후반~20대 초의 음악이 라이브러리의 뼈대를 이룹니다. 그 시절 강한 감정과 함께 신경망에 새겨진 곡들이 지금도 취향을 지배하고 있습니다.",
  },
  balanced: {
    title: "균형형",
    body: "각인기 음악과 새로운 음악이 고르게 섞여 있습니다. 뿌리를 유지하면서도 탐색을 멈추지 않는 상태입니다.",
  },
  unknown: {
    title: "데이터 부족",
    body: "발매연도가 있는 곡이 아직 적습니다. 곡 분석을 더 돌리면 정확해집니다.",
  },
};

function ImprintSection({ a }: { a: ImprintAnalysis }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold">🧬 각인 코어 — 회상 융기</h2>
        <p className="mt-1 text-sm text-neutral-400">
          15~25세(정서 정점 ≈ 17세)에 들은 음악은 사춘기 호르몬과 함께 뇌에 강하게
          새겨집니다. 라이브러리의 발매연도에서 그 시기를 찾아봅니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-neutral-400">
          {a.birthYear ? `출생연도: ${a.birthYear}년` : "출생연도를 입력하면 각인 구간이 표시됩니다"}
        </span>
        <BirthYearInput current={a.birthYear} />
      </div>

      {!a.hasYearData ? (
        <div className="flex flex-col gap-2 rounded-lg bg-amber-950/40 px-3 py-3">
          <p className="text-sm text-amber-200">
            아직 발매연도 데이터가 없습니다. 아래 버튼으로 Deezer 에서 곡별 발매연도를
            불러오세요. (&ldquo;곡 분석&rdquo;은 장르·무드만 채우고, 발매연도는 별도입니다.)
          </p>
          <YearBackfill missing />
        </div>
      ) : (
        <>
          <YearHistogram a={a} />
          <p className="text-[11px] text-neutral-500">
            발매연도가 확인된 곡 {a.totalWithYear.toLocaleString()}곡 · 전체 좋아요의{" "}
            {Math.round(a.coverage * 100)}%
            {a.coverage < 0.7 && " — Deezer 매칭이 안 된 곡은 연도를 알 수 없습니다"}
          </p>
          <YearBackfill missing={false} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="각인기 비중"
              value={`${Math.round(a.imprintShare * 100)}%`}
              sub={a.window ? `${a.window.start}~${a.window.end}년` : "출생연도 필요"}
            />
            <Stat
              label="최근 3년"
              value={`${Math.round(a.recentShare * 100)}%`}
              sub="현재진행형 디깅"
            />
            <Stat
              label="취향 무게중심"
              value={a.medianYear ? `${a.medianYear}년` : "—"}
              sub={a.medianAge != null ? `당신 ${a.medianAge}세 무렵` : "곡의 중앙값"}
            />
            <Stat
              label="최다 발매연도"
              value={a.peakYear ? `${a.peakYear}년` : "—"}
              sub={`${a.totalWithYear.toLocaleString()}곡 기준`}
            />
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-4">
            <p className="text-sm font-semibold text-emerald-300">
              {STAGE_TEXT[a.stage].title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-300">
              {STAGE_TEXT[a.stage].body}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/** Year-by-year bar chart with the 15–25 imprint window highlighted. */
function YearHistogram({ a }: { a: ImprintAnalysis }) {
  const bars = a.histogram;
  if (bars.length === 0) return null;
  const first = bars[0].year;
  const last = bars[bars.length - 1].year;
  const counts = new Map(bars.map((b) => [b.year, b.count]));
  const max = Math.max(...bars.map((b) => b.count), 1);

  // Fill every calendar year so the time axis is uniform.
  const years: { year: number; count: number; inWindow: boolean }[] = [];
  for (let y = first; y <= last; y++) {
    years.push({
      year: y,
      count: counts.get(y) ?? 0,
      inWindow: a.window != null && y >= a.window.start && y <= a.window.end,
    });
  }
  const ticks = years.filter((y) => y.year % 10 === 0);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-44 items-end gap-[2px]">
        {years.map((y) => (
          <div
            key={y.year}
            className="group relative flex h-full flex-1 items-end"
            style={{ minWidth: 2 }}
          >
            <div
              className={`w-full rounded-sm ${
                y.inWindow ? "bg-emerald-400" : "bg-white/20"
              } group-hover:bg-emerald-300`}
              style={{ height: `${Math.max(y.count > 0 ? 3 : 0, (y.count / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black px-1.5 py-0.5 text-[11px] text-white group-hover:block">
              {y.year} · {y.count}곡
            </span>
          </div>
        ))}
      </div>
      <div className="relative h-4 text-[10px] text-neutral-600">
        {ticks.map((t) => (
          <span
            key={t.year}
            className="absolute -translate-x-1/2"
            style={{ left: `${((t.year - first) / Math.max(1, last - first)) * 100}%` }}
          >
            {t.year}
          </span>
        ))}
      </div>
      {a.window && (
        <p className="text-[11px] text-emerald-300/80">
          ■ 초록 막대 = {a.window.start}~{a.window.end}년 (당신의 15~25세 각인기)
        </p>
      )}
    </div>
  );
}

/* ──────────────────────  Pillar A — Novelty index  ────────────────────── */

function NoveltySection({ n }: { n: NoveltyIndex }) {
  const pct = (v: number) => Math.round(v * 100);
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div>
        <h2 className="text-lg font-semibold">🎯 예측 · 신선함 지수</h2>
        <p className="mt-1 text-sm text-neutral-400">
          음악의 쾌감은 <em>예측이 적당히 맞거나 기분 좋게 빗나갈 때</em> 정점에
          닿습니다. 당신의 취향이 익숙함과 신선함 사이 어디에 있는지 봅니다.
        </p>
      </div>

      {/* familiarity ↔ novelty position */}
      <div className="flex flex-col gap-1">
        <div className="relative h-9 rounded-lg bg-gradient-to-r from-sky-500/20 via-emerald-500/30 to-fuchsia-500/20">
          {/* sweet-spot zone 0.34–0.62 */}
          <div
            className="absolute inset-y-0 border-x border-emerald-400/40 bg-emerald-400/10"
            style={{ left: "34%", width: "28%" }}
          />
          <div
            className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white shadow"
            style={{ left: `${Math.min(98, Math.max(2, pct(n.noveltyScore)))}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-neutral-500">
          <span>익숙함 · 예측 가능</span>
          <span className="text-emerald-400">스위트 스폿</span>
          <span>신선함 · 모험</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {n.components.map((c) => (
          <div key={c.key} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 text-neutral-300">{c.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${pct(c.value)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-neutral-500">{pct(c.value)}</span>
          </div>
        ))}
      </div>
      <p className="-mt-1 text-[11px] text-neutral-600">
        {n.components.map((c) => `${c.label}: ${c.hint}`).join("  ·  ")}
      </p>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-sm leading-relaxed text-neutral-200">{n.verdict}</p>
        {n.topGenre && (
          <p className="mt-2 text-xs text-neutral-500">
            가장 비중 큰 장르: {n.topGenre.name} ({Math.round(n.topGenre.share * 100)}%) ·
            서로 다른 장르 {n.distinctGenres}종 · 분석된 곡 {n.analyzed.toLocaleString()}곡
          </p>
        )}
      </div>
    </section>
  );
}

/* ──────────────────────────────  shared  ─────────────────────────────── */

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-bold">{value}</div>
      <div className="text-[11px] text-neutral-600">{sub}</div>
    </div>
  );
}
