import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playlist Analyzer",
  description: "유튜브 뮤직 좋아요 곡 특성 분석 · music-map · 추천",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex min-h-screen flex-col overflow-x-hidden bg-neutral-950 text-neutral-100 antialiased">
        <NavBar />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
