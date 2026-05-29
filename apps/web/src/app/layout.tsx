import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthMenu } from "@/components/AuthMenu";
import { CookieBanner } from "@/components/CookieBanner";
import { NavBar } from "@/components/NavBar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Footer } from "@/components/Footer";
import { getLocale } from "@/lib/i18n-server";
import "./globals.css";

const DESC =
  "Turns your YouTube Music liked songs into a research-grounded portrait of your taste: Taste DNA, an interactive artist map, and recommendations.";

export const metadata: Metadata = {
  metadataBase: new URL("https://earprint.kwanho.dev"),
  title: "Earprint — understand your music taste",
  description: DESC,
  openGraph: {
    title: "Earprint",
    description: DESC,
    url: "https://earprint.kwanho.dev",
    siteName: "Earprint",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Earprint",
    description: DESC,
  },
  verification: {
    google: "eW858xx9u5r9SCiOWqOoW9fzPyacwUxJlYT1B0tEXBQ",
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
        <NavBar locale={locale} authMenu={<AuthMenu locale={locale} />} />
        {/* pb-16 sm:pb-0 leaves room for the mobile bottom-nav so
            fixed-bottom buttons (cookie banner, footer text) aren't
            obscured. */}
        <div className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</div>
        <Footer locale={locale} />
        <CookieBanner locale={locale} />
        <MobileBottomNav locale={locale} />
      </body>
    </html>
  );
}
