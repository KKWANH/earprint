"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { dicts, type Locale } from "@/lib/i18n";
import { LocaleToggle } from "./LocaleToggle";

const LINKS = [
  { href: "/library", key: "library" },
  { href: "/dna", key: "dna" },
  { href: "/map", key: "map" },
  { href: "/recommend", key: "recommend" },
  { href: "/worldcup", key: "worldcup" },
  { href: "/profile", key: "profile" },
  { href: "/connect", key: "connect" },
  { href: "/account", key: "account" },
] as const;

/** Shared top navigation — inline on desktop, hamburger dropdown on mobile.
 *  `authMenu` is rendered server-side and slotted in so this client
 *  component doesn't have to know about the session. */
export function NavBar({
  locale,
  authMenu,
}: {
  locale: Locale;
  authMenu?: ReactNode;
}) {
  const nav = dicts[locale].nav;
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);

  // ESC closes the mobile hamburger menu. Without this, a keyboard
  // user who opened the menu (Tab → Enter on the ☰ button) had no
  // way to dismiss it from the keyboard — Tab kept cycling through
  // the still-open dropdown items.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex shrink-0 items-center gap-1.5 text-sm font-bold tracking-tight"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-5 w-5" />
          {/* Wrapped in a single span so flexbox doesn't treat 'Ear' as an
              anonymous flex item and add a gap before 'print'. */}
          <span>
            Ear<span className="text-emerald-400">print</span>
          </span>
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
          {authMenu && <div className="hidden sm:block">{authMenu}</div>}
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
          {authMenu && (
            <div className="mt-1 border-t border-white/10 px-1 pt-2">
              {authMenu}
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
