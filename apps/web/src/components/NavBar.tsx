"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/** Shared top navigation — inline on desktop, hamburger dropdown on mobile. */
const LINKS = [
  { href: "/library", label: "라이브러리" },
  { href: "/dna", label: "취향 DNA" },
  { href: "/map", label: "아티스트 맵" },
  { href: "/recommend", label: "추천" },
  { href: "/profile", label: "심리분석" },
  { href: "/connect", label: "확장 연결" },
];

export function NavBar() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/library"
          onClick={() => setOpen(false)}
          className="shrink-0 text-sm font-bold tracking-tight"
        >
          🎧 Playlist<span className="text-emerald-400">Analyzer</span>
        </Link>

        {/* desktop — inline links */}
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
              {l.label}
            </Link>
          ))}
        </nav>

        {/* mobile — hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="메뉴"
          aria-expanded={open}
          className="rounded-md px-2 py-1 text-lg leading-none text-neutral-300 hover:bg-white/10 sm:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* mobile — dropdown panel */}
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
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
