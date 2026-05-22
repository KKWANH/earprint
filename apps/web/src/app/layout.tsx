import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const DESC =
  "Turns your YouTube Music liked songs into a research-grounded portrait of your taste: Taste DNA, an interactive artist map, and recommendations.";

export const metadata: Metadata = {
  metadataBase: new URL("https://music.kwanho.dev"),
  title: "Earprint — understand your music taste",
  description: DESC,
  openGraph: {
    title: "Earprint",
    description: DESC,
    url: "https://music.kwanho.dev",
    siteName: "Earprint",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earprint",
    description: DESC,
  },
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
