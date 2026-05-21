import { auth, signIn } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getArtistMap, getGhostArtists } from "@/lib/artistMap";
import { ArtistMap } from "./ArtistMap";

export default async function MapPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/map" });
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
  const data = await getArtistMap(userId);
  const ghosts = data.artists.length > 0 ? await getGhostArtists(data.artists) : [];

  return (
    <main className="flex flex-1 flex-col">
      <header className="border-b border-white/10 px-4 py-3 sm:px-6">
        <h1 className="text-lg font-bold">취향 아티스트 맵</h1>
        <p className="text-xs text-neutral-500">
          좋아요한 아티스트 {data.artists.length}명
          {ghosts.length > 0 && ` · 안 들어본 추천 ${ghosts.length}명`} · 장르가
          비슷할수록 가까이 모입니다
        </p>
      </header>

      {data.artists.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-neutral-500">
          아직 동기화된 곡이 없습니다. 확장 프로그램으로 좋아요 목록을 먼저
          동기화하세요.
        </div>
      ) : (
        <ArtistMap data={data} ghosts={ghosts} />
      )}
    </main>
  );
}
