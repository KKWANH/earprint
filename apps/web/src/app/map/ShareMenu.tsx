"use client";

import type { RefObject } from "react";
import type { Locale } from "@/lib/i18n";
import { CanvasShareMenu } from "@/components/CanvasShareMenu";
import { canvasShareDict } from "@/lib/i18n/canvasShare";

/**
 * Artist-map share controls. Thin wrapper over the generic
 * CanvasShareMenu — wires the shared canvas-share dict + filename + alt.
 */
export function ShareMenu({
  canvasRef,
  locale,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  locale: Locale;
}) {
  return (
    <CanvasShareMenu
      canvasRef={canvasRef}
      strings={canvasShareDict(locale)}
      filename="earprint-artist-map"
      embedAlt="My music taste map — Earprint"
    />
  );
}
