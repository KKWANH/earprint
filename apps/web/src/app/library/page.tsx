import Link from "next/link";
import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getLibraryStats, type Count, type AudioFeelAgg } from "@/lib/library";
import { JobPanel } from "./JobPanel";
import { PreviewButton } from "./PreviewButton";
import { ExcludeButton } from "./ExcludeButton";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/library" });
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
  const stats = await getLibraryStats(userId);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">라이브러리 분석</h1>
        <nav className="flex gap-4 text-sm text-neutral-400">
          <Link href="/recommend" className="hover:text-white">
            추천 월드컵
          </Link>
          <Link href="/profile" className="hover:text-white">
            AI 심리분석
          </Link>
          <Link href="/connect" className="hover:text-white">
            확장 연결
          </Link>
        </nav>
      </header>

      <JobPanel
        kind="enrich"
        title="트랙 분석"
        description="Deezer · Last.fm 으로 장르 · 무드 · 앨범 · 미리듣기를 보강합니다."
        accent="bg-emerald-500"
      />
      <JobPanel
        kind="ai_enrich"
        title="AI 보강"
        description="API 가 못 채운 곡을 Gemini 가 추론하고, 뮤비·모음 채널을 원곡 아티스트로 재매핑합니다."
        accent="bg-indigo-500"
      />
      <JobPanel
        kind="audio_feel"
        title="오디오 특성 분석"
        description="Gemini 가 곡별 에너지 · 템포 · 어쿠스틱 정도와 악기 특징을 추정합니다."
        accent="bg-sky-500"
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="좋아요 곡" value={stats.total.toLocaleString()} />
        <Stat label="분석 완료" value={stats.enriched.toLocaleString()} />
        <Stat label="아티스트" value={stats.distinctArtists.toLocaleString()} />
        <Stat
          label="앨범 몰입도"
          value={`${Math.round(stats.albumDepth.concentration * 100)}%`}
        />
      </section>

      <BarCard
        title="가장 많이 좋아한 아티스트"
        items={stats.topArtists}
        color="bg-amber-500"
        empty="아직 데이터가 없습니다."
        excludable
      />
      <BarCard
        title="장르 분포"
        items={stats.topGenres}
        color="bg-indigo-500"
        empty="분석을 실행하면 장르가 채워집니다."
      />
      <BarCard
        title="무드 분포"
        items={stats.topMoods}
        color="bg-rose-500"
        empty="분석을 실행하면 무드가 채워집니다."
      />

      {stats.audioFeel && <FeelCard feel={stats.audioFeel} />}
      <BarCard
        title="자주 등장하는 악기"
        items={stats.topInstruments}
        color="bg-sky-500"
        empty="오디오 특성 분석을 실행하면 채워집니다."
      />
      <BarCard
        title={`가장 깊게 판 앨범 — 앨범당 좋아요 곡 수 (3곡 이상 앨범 ${stats.albumDepth.deepAlbums}개)`}
        items={stats.topAlbums}
        color="bg-fuchsia-500"
        empty="여러 곡을 좋아한 앨범이 아직 없습니다."
      />

      {stats.excludedArtists.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
          <h2 className="font-semibold">제외된 아티스트 ({stats.excludedArtists.length})</h2>
          <div className="flex flex-wrap gap-2">
            {stats.excludedArtists.map((a) => (
              <span
                key={a}
                className="flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-1 text-sm text-neutral-400"
              >
                {a}
                <ExcludeButton artist={a} restore />
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="font-semibold">트랙 (최근 {stats.tracks.length}곡)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-neutral-500">
                <th className="py-2 pr-3 font-medium">제목</th>
                <th className="py-2 pr-3 font-medium">아티스트</th>
                <th className="py-2 pr-3 font-medium">장르</th>
                <th className="py-2 pr-3 font-medium">무드</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {stats.tracks.map((t, i) => (
                <tr key={i} className="border-b border-neutral-800/60 last:border-0">
                  <td className="max-w-[14rem] truncate py-1.5 pr-3">{t.title}</td>
                  <td className="max-w-[9rem] truncate py-1.5 pr-3 text-neutral-400">
                    {t.artist}
                  </td>
                  <td className="max-w-[11rem] truncate py-1.5 pr-3 text-neutral-400">
                    {t.genres?.slice(0, 2).join(", ") ?? "—"}
                  </td>
                  <td className="max-w-[9rem] truncate py-1.5 pr-3 text-neutral-400">
                    {t.moods?.slice(0, 2).join(", ") ?? "—"}
                  </td>
                  <td className="py-1.5">
                    <PreviewButton deezerId={t.deezerId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function FeelCard({ feel }: { feel: AudioFeelAgg }) {
  const axes = [
    { label: "에너지", lo: "차분", hi: "격렬", v: feel.energy },
    { label: "템포", lo: "느림", hi: "빠름", v: feel.tempo },
    { label: "사운드", lo: "전자음", hi: "생악기", v: feel.acousticness },
  ];
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="font-semibold">
        오디오 특성{" "}
        <span className="text-xs font-normal text-neutral-500">
          · {feel.analyzed.toLocaleString()}곡 평균
        </span>
      </h2>
      <div className="flex flex-col gap-3">
        {axes.map((a) => (
          <div key={a.label} className="flex items-center gap-3 text-sm">
            <span className="w-12 shrink-0 text-neutral-300">{a.label}</span>
            <span className="w-12 shrink-0 text-right text-xs text-neutral-600">{a.lo}</span>
            <div className="relative h-2 flex-1 rounded-full bg-neutral-800">
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-sky-400"
                style={{ left: `calc(${Math.round(a.v * 100)}% - 7px)` }}
              />
            </div>
            <span className="w-12 shrink-0 text-xs text-neutral-600">{a.hi}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function BarCard({
  title,
  items,
  color,
  empty,
  excludable,
}: {
  title: string;
  items: Count[];
  color: string;
  empty: string;
  excludable?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{empty}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((it) => (
            <div key={it.name} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate text-neutral-300">{it.name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-neutral-800">
                <div
                  className={`h-full ${color}`}
                  style={{ width: `${(it.count / max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-neutral-500">{it.count}</span>
              {excludable && <ExcludeButton artist={it.name} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
