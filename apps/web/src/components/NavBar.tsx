"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { dicts, type Locale } from "@/lib/i18n";
import { LocaleToggle } from "./LocaleToggle";

const LINKS = [
  { href: "/library", key: "library" },
  { href: "/dna", key: "dna" },
  { href: "/map", key: "map" },
  { href: "/recommend", key: "recommend" },
  { href: "/profile", key: "profile" },
  { href: "/connect", key: "connect" },
] as const;

/** Shared top navigation — inline on desktop, hamburger dropdown on mobile. */
export function NavBar({ locale }: { locale: Locale }) {
  const nav = dicts[locale].nav;
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="shrink-0 text-sm font-bold tracking-tight"
        >
          🎧 Playlist<span className="text-emerald-400">Analyzer</span>
        </Link>

        <nav className="hidden gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                isActive(l.href)
                  ? "bg-white/10 font-medium text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {nav[l.key]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleToggle locale={locale} />
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            className="rounded-md px-2 py-1 text-lg leading-none text-neutral-300 hover:bg-white/10 sm:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-0.5 border-t border-white/10 px-3 py-2 sm:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-md px-3 py-2.5 text-sm transition-colors ${
                isActive(l.href)
                  ? "bg-white/10 font-medium text-white"
                  : "text-neutral-300 hover:bg-white/5"
              }`}
            >
              {nav[l.key]}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
