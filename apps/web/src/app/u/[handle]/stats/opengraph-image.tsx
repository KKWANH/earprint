import { ImageResponse } from "next/og";
import { getSql } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Earprint creator stats";

/**
 * Dedicated OG image for /u/[handle]/stats — different from the base
 * /u/[handle] image so the share preview reflects "deeper stats" rather
 * than "profile". Surfaces:
 *   - @handle
 *   - total plays + total champions crowned
 *   - 12-bar plays-per-month sparkline
 *
 * Falls back to a generic 'creator stats' card when the handle doesn't
 * resolve, so social platforms don't fetch a broken image.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const lc = handle.toLowerCase().trim();

  let totalPlays = 0;
  let totalChampions = 0;
  let monthly: { month: string; plays: number }[] = [];
  if (/^[a-z0-9._-]{1,30}$/i.test(lc)) {
    try {
      const sql = getSql();
      const totals = await sql`
        SELECT coalesce(sum(w.play_count), 0)::int AS plays,
               coalesce(sum(i.champion_count), 0)::int AS champions
        FROM community_worldcups w
        JOIN users u ON u.id = w.owner_user_id
        LEFT JOIN community_worldcup_items i ON i.worldcup_id = w.id
        WHERE w.visibility = 'public'
          AND lower(split_part(u.email, '@', 1)) = ${lc}`;
      totalPlays = Number(totals[0]?.plays ?? 0);
      totalChampions = Number(totals[0]?.champions ?? 0);
      try {
        const hist = await sql`
          WITH months AS (
            SELECT date_trunc('month', now()) - (n || ' months')::interval AS m
            FROM generate_series(0, 11) AS n
          )
          SELECT to_char(m.m, 'YYYY-MM') AS month,
                 count(f.id)::int AS plays
          FROM months m
          LEFT JOIN community_worldcup_finishes f
            ON date_trunc('month', f.finished_at) = m.m
            AND f.worldcup_id IN (
              SELECT w.id FROM community_worldcups w
              JOIN users u ON u.id = w.owner_user_id
              WHERE w.visibility = 'public'
                AND lower(split_part(u.email, '@', 1)) = ${lc}
            )
          GROUP BY m.m
          ORDER BY m.m ASC`;
        monthly = hist.map((r) => ({
          month: r.month as string,
          plays: Number(r.plays ?? 0),
        }));
      } catch {
        /* finishes table missing — leave empty */
      }
    } catch {
      /* generic card */
    }
  }
  const maxMonth = Math.max(1, ...monthly.map((m) => m.plays));

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #082f49 0%, #0a0a0b 55%, #1c1917 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "72px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 20,
            letterSpacing: 8,
            color: "#7dd3fc",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          📊 creator stats
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 72,
            fontWeight: 800,
            textAlign: "center",
            maxWidth: 1040,
            lineHeight: 1.05,
          }}
        >
          @{handle}
        </div>
        {(totalPlays > 0 || totalChampions > 0) && (
          <div
            style={{
              display: "flex",
              marginTop: 24,
              gap: 32,
              fontSize: 30,
              color: "#d6d3d1",
            }}
          >
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: "#7dd3fc" }}>
                {totalPlays.toLocaleString()}
              </span>
              <span style={{ fontSize: 18, color: "#94a3b8" }}>plays</span>
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: "#fbbf24" }}>
                {totalChampions.toLocaleString()}
              </span>
              <span style={{ fontSize: 18, color: "#94a3b8" }}>champions</span>
            </span>
          </div>
        )}
        {/* 12-month bars */}
        {monthly.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              marginTop: 32,
              width: 680,
              height: 80,
            }}
          >
            {monthly.map((m) => (
              <div
                key={m.month}
                style={{
                  display: "flex",
                  flex: 1,
                  height: `${Math.max(2, (m.plays / maxMonth) * 100)}%`,
                  backgroundColor: m.plays > 0 ? "#38bdf8" : "#1e293b",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 46,
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            color: "#a8a29e",
          }}
        >
          🎧 Earprint · earprint.kwanho.dev/u/{handle}/stats
        </div>
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
