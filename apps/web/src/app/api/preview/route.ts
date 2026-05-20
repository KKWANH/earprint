import { ensureConnection } from "@/lib/connection";

/**
 * Deezer 미리듣기 URL 프록시.
 * Deezer preview URL 은 서명·만료되므로 저장본을 쓰지 않고 재생 직전에 새로 받는다.
 */
export async function GET(req: Request) {
  try {
    await ensureConnection();
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  const deezerId = new URL(req.url).searchParams.get("deezerId");
  if (!deezerId || !/^\d+$/.test(deezerId)) {
    return json({ error: "deezerId required" }, 400);
  }

  try {
    const res = await fetch(`https://api.deezer.com/track/${deezerId}`, {
      signal: AbortSignal.timeout(6000),
    });
    const data: any = await res.json();
    const url: string | undefined = data?.preview;
    if (!url) return json({ error: "no preview" }, 404);
    return json({ url }, 200);
  } catch {
    return json({ error: "deezer error" }, 502);
  }
}

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
