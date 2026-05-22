import { ImageResponse } from "next/og";
import { getSql } from "@/lib/db";
import type { AiProfile } from "@/lib/profile";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Earprint music persona";

/** Per-profile share-link preview image — the persona as a card. */
export default async function Image({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  let p: AiProfile | undefined;
  try {
    const sql = getSql();
    // English copy keeps the text renderable with the default font.
    const rows = await sql`
      SELECT ai_profile_en, ai_profile
      FROM taste_profiles WHERE share_id = ${shareId}`;
    p = (rows[0]?.ai_profile_en ?? rows[0]?.ai_profile) as AiProfile | undefined;
  } catch {
    /* fall through to a generic card */
  }
  const persona = p?.persona;

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
          background: "linear-gradient(135deg, #1e1b4b 0%, #0a0a0b 55%, #3b0764 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "64px",
        }}
      >
        <div style={{ display: "flex", fontSize: 130 }}>{persona?.emoji ?? "🎧"}</div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 26,
            letterSpacing: 6,
            color: "#a5b4fc",
            textTransform: "uppercase",
          }}
        >
          {persona?.archetype ?? "Music persona"}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 10,
            fontSize: 66,
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          {persona?.name ?? "Earprint"}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 18,
            fontSize: 30,
            color: "#d1d5db",
            textAlign: "center",
            maxWidth: 920,
          }}
        >
          {persona?.tagline ?? "Understand your music taste."}
        </div>
        {p?.diggingScore != null && (
          <div
            style={{
              display: "flex",
              marginTop: 30,
              fontSize: 28,
              fontWeight: 700,
              color: "#34d399",
            }}
          >
            Digging {p.diggingScore} / 100
          </div>
        )}
        <div
          style={{
            position: "absolute",
            bottom: 46,
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: "#9ca3af",
          }}
        >
          🎧 Earprint
        </div>
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
