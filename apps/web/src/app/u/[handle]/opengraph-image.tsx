import { ImageResponse } from "next/og";
import { getSql } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Earprint worldcup creator";

/**
 * Dynamic OG image for /u/[handle]. Rendered server-side via next/og
 * so Twitter / Slack / Discord previews don't require the JS bundle.
 *
 * Pulls the handle's aggregate stats (n worldcups + total plays)
 * directly from the DB rather than re-running the page-level query,
 * so the share card is cheap even when previewed by a high-traffic
 * link.
 *
 * Falls back to a generic "creator profile" card when the handle
 * doesn't resolve — the page itself 404s, but social platforms still
 * fetch the OG image first and surfacing a broken image is uglier
 * than a generic one.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const lc = handle.toLowerCase().trim();

  let worldcupCount = 0;
  let totalPlays = 0;
  if (/^[a-z0-9._-]{1,30}$/i.test(lc)) {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT count(*)::int AS n,
               coalesce(sum(w.play_count), 0)::int AS plays
        FROM community_worldcups w
        JOIN users u ON u.id = w.owner_user_id
        WHERE w.visibility = 'public'
          AND lower(split_part(u.email, '@', 1)) = ${lc}`;
      worldcupCount = (rows[0]?.n as number) ?? 0;
      totalPlays = (rows[0]?.plays as number) ?? 0;
    } catch {
      /* generic card */
    }
  }

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
            "linear-gradient(135deg, #0c4a6e 0%, #0a0a0b 55%, #1c1917 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "72px",
        }}
      >
        {/* Avatar circle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 140,
            height: 140,
            borderRadius: 999,
            backgroundColor: "rgba(56,189,248,0.18)",
            border: "2px solid rgba(56,189,248,0.55)",
            fontSize: 60,
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          {(lc[0] ?? "?").toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 20,
            letterSpacing: 8,
            color: "#7dd3fc",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          Worldcup creator
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 68,
            fontWeight: 800,
            textAlign: "center",
            maxWidth: 1040,
            lineHeight: 1.05,
          }}
        >
          @{handle}
        </div>
        {worldcupCount > 0 && (
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 24,
              color: "#d6d3d1",
              padding: "8px 22px",
              border: "1px solid rgba(56,189,248,0.45)",
              borderRadius: 999,
            }}
          >
            {worldcupCount.toLocaleString()} worldcups ·{" "}
            {totalPlays.toLocaleString()} total plays
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 46,
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: "#a8a29e",
          }}
        >
          🎧 Earprint · earprint.kwanho.dev/u/{handle}
        </div>
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
