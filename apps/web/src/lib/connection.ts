import { auth } from "@/auth";
import { getSql } from "@/lib/db";
import { generateSyncToken } from "@/lib/tokens";

export interface Connection {
  userId: string;
  token: string;
}

export interface RecentTrack {
  title: string;
  artist: string;
  capturedAt: string;
}

/**
 * 로그인 세션을 users 테이블에 멱등하게 반영하고 동기화 토큰을 보장한다.
 * 최초 호출 시 사용자 행과 토큰을 만들고, 이후 호출은 기존 토큰을 유지한다.
 */
export async function ensureConnection(): Promise<Connection> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("로그인이 필요합니다");

  const sql = getSql();
  const rows = await sql`
    INSERT INTO users (email, display_name, sync_token)
    VALUES (${email}, ${session.user?.name ?? null}, ${generateSyncToken()})
    ON CONFLICT (email) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          sync_token   = COALESCE(users.sync_token, EXCLUDED.sync_token),
          updated_at   = now()
    RETURNING id, sync_token`;

  return { userId: rows[0].id as string, token: rows[0].sync_token as string };
}

/** 동기화된 좋아요 통계 + 최근 항목. */
export async function getLibrarySummary(
  userId: string,
): Promise<{ count: number; recent: RecentTrack[] }> {
  const sql = getSql();
  const countRows = await sql`
    SELECT count(*)::int AS c FROM user_tracks WHERE user_id = ${userId}`;
  const recent = await sql`
    SELECT t.title, t.artist, ut.captured_at
    FROM user_tracks ut
    JOIN tracks t ON t.id = ut.track_id
    WHERE ut.user_id = ${userId}
    ORDER BY ut.captured_at DESC
    LIMIT 20`;
  return {
    count: countRows[0].c as number,
    recent: recent.map((r) => ({
      title: r.title as string,
      artist: r.artist as string,
      capturedAt: r.captured_at as string,
    })),
  };
}
