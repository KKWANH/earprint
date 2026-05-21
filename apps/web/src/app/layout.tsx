import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playlist Analyzer — understand your music taste",
  description:
    "Turns your YouTube Music liked songs into a research-grounded portrait of your taste: Taste DNA, an interactive artist map, and recommendations.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col overflow-x-hidden bg-neutral-950 text-neutral-100 antialiased">
        <NavBar locale={locale} />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
