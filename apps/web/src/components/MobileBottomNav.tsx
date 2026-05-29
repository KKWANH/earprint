"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

/**
 * R36 — mobile-only bottom-nav for the 5 most-used pages. The full
 * 8-link NavBar still lives at the top + opens via hamburger for
 * everything else. This component is *additive* — top NavBar stays
 * as-is; this adds a thumb-reachable bar at the bottom for the
 * actions users hit most.
 *
 * Hidden at sm+ (sm:hidden). Safe-area-inset-bottom adds for
 * iOS notch / Android gesture pill.
 *
 * Picked the 5: Library (your taste), Recommend (action), Worldcup
 * (engagement loop), Profile (your insights), Account (settings).
 * Genres / Map / Connect / Admin stay in the top hamburger.
 */
const ENTRIES: { href: string; key: string; emoji: string }[] = [
  { href: "/library",   key: "library",   emoji: "🎵" },
  { href: "/recommend", key: "recommend", emoji: "✨" },
  { href: "/worldcup",  key: "worldcup",  emoji: "🏆" },
  { href: "/profile",   key: "profile",   emoji: "🧠" },
  { href: "/account",   key: "account",   emoji: "👤" },
];

const LABELS_KO: Record<string, string> = {
  library: "라이브러리",
  recommend: "추천",
  worldcup: "월드컵",
  profile: "심리",
  account: "계정",
};
const LABELS_EN: Record<string, string> = {
  library: "Library",
  recommend: "Discover",
  worldcup: "Worldcup",
  profile: "Profile",
  account: "Account",
};

export function MobileBottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname() ?? "";
  const labels = locale === "ko" ? LABELS_KO : LABELS_EN;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 border-t border-white/10 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      aria-label={locale === "ko" ? "모바일 네비게이션" : "Mobile navigation"}
    >
      {ENTRIES.map((e) => {
        // Active when the pathname starts with the entry's href —
        // /library/foo still highlights "library".
        const active =
          pathname === e.href ||
          (e.href !== "/" && pathname.startsWith(e.href + "/"));
        return (
          <Link
            key={e.key}
            href={e.href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
              active
                ? "text-emerald-300"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <span className="text-base leading-none">{e.emoji}</span>
            <span>{labels[e.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
