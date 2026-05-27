import { ImageResponse } from "next/og";
import { getSql } from "@/lib/db";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Earprint World Cup champion";

interface ChampionPayload {
  artist?: string;
  title?: string;
  id?: string;
}

/**
 * Dynamic OG image for /worldcup/champion/[id]. Twitter / Slack /
 * Discord previews fetch this. We render entirely server-side via
 * `next/og` (Vercel + Cloudflare both support it) — no client
 * dependency, no canvas screenshot dance.
 *
 * Style mirrors the in-app ChampionView so the share card feels like
 * a continuation of the bracket, not a separate brand surface.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let category = "";
  let bracketSize = 0;
  let champion: ChampionPayload = {};
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT category, size, champion
      FROM tournament_results WHERE id = ${id}::uuid`;
    if (rows[0]) {
      category = String(rows[0].category ?? "");
      bracketSize = Number(rows[0].size ?? 0);
      champion = rows[0].champion as ChampionPayload;
    }
  } catch {
    /* render generic fallback card */
  }

  // Genre champions have title but no artist; song champions have both.
  // Compose one line that reads naturally for either.
  const subject = champion.artist
    ? `${champion.title ?? "—"} · ${champion.artist}`
    : champion.title ?? champion.id ?? "Champion";

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
            "linear-gradient(135deg, #451a03 0%, #0a0a0b 55%, #1c1917 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "72px",
        }}
      >
        {/* Trophy + sash */}
        <div style={{ display: "flex", fontSize: 120 }}>🏆</div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 24,
            letterSpacing: 8,
            color: "#fbbf24",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {bracketSize > 0 ? `${bracketSize}-bracket champion` : "World Cup champion"}
        </div>
        {/* Subject */}
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 60,
            fontWeight: 800,
            textAlign: "center",
            maxWidth: 1040,
            lineHeight: 1.1,
          }}
        >
          {subject}
        </div>
        {/* Category tag */}
        {category && (
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 22,
              color: "#d6d3d1",
              padding: "6px 18px",
              border: "1px solid rgba(251,191,36,0.4)",
              borderRadius: 999,
              textTransform: "lowercase",
            }}
          >
            {category}
          </div>
        )}
        {/* Brand strip */}
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
          🎧 Earprint · earprint.kwanho.dev/worldcup
        </div>
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
