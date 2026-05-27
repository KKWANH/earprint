"use client";

import type { RefObject } from "react";
import type { Locale } from "@/lib/i18n";
import { CanvasShareMenu } from "@/components/CanvasShareMenu";
import { canvasShareDict } from "@/lib/i18n/canvasShare";

/**
 * Artist-map share controls. Thin wrapper over the generic
 * CanvasShareMenu — wires the shared canvas-share dict + filename +
 * alt, plus the optional iframe-embed URL when the user has a
 * shareId (= they've run an AI analysis and got a public share link
 * minted in taste_profiles).
 */
export function ShareMenu({
  canvasRef,
  locale,
  shareId,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  locale: Locale;
  /** Public share id for /s/<shareId>. When present, the share menu
   *  gains a "Copy interactive embed" option that emits an iframe
   *  to /map/embed/<shareId>. Static-PNG and clipboard options work
   *  regardless. */
  shareId?: string | null;
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://earprint.kwanho.dev";
  return (
    <CanvasShareMenu
      canvasRef={canvasRef}
      strings={canvasShareDict(locale)}
      filename="earprint-artist-map"
      embedAlt="My music taste map — Earprint"
      embedHref={`${origin}/map`}
      iframeUrl={shareId ? `${origin}/map/embed/${shareId}` : undefined}
    />
  );
}
