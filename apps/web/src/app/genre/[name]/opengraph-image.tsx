import { ImageResponse } from "next/og";
import { genreHue } from "@/lib/forceGraph";
import { getGenreContent } from "@/data/genre-content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Earprint genre";

/**
 * Dynamic OG image for /genre/[name] — rendered server-side via
 * next/og. When the genre has curated content (data/genre-content.ts)
 * we surface its emoji + era + origin chips alongside the name; for
 * the long-tail genres without curated entries the card still
 * renders the gradient banner + name so social previews never
 * 404-image.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const content = getGenreContent(name);
  const hue = content?.accentHue ?? genreHue(name);
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
          background: `linear-gradient(135deg, hsl(${hue}, 55%, 24%) 0%, #0a0a0b 55%, hsl(${
            (hue + 50) % 360
          }, 45%, 12%) 100%)`,
          color: "#ffffff",
          fontFamily: "sans-serif",
          padding: "72px",
        }}
      >
        {content?.emoji && (
          <div style={{ display: "flex", fontSize: 140 }}>
            {content.emoji}
          </div>
        )}
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 24,
            letterSpacing: 8,
            color: "rgba(255,255,255,0.7)",
            textTransform: "uppercase",
            fontWeight: 700,
          }}
        >
          {content?.eraEn ?? "genre"}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 14,
            fontSize: 88,
            fontWeight: 800,
            textTransform: "capitalize",
            textAlign: "center",
            maxWidth: 1040,
            lineHeight: 1.05,
          }}
        >
          {name}
        </div>
        {content?.originEn && (
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 22,
              color: "#d6d3d1",
              padding: "8px 22px",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 999,
            }}
          >
            {content.originEn}
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
          🎧 Earprint
        </div>
      </div>
    ),
    { ...size, emoji: "twemoji" },
  );
}
