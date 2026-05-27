"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * "Back" link in the genre detail page header. Used to hard-link to
 * /library, which broke the navigation expectation when the user
 * arrived from /profile (their psychology-analysis page) and tapped
 * Back expecting to return there — they ended up dumped into /library
 * with no obvious way back.
 *
 * Now: if the browser has navigation history (most common case),
 * fire router.back() to honour the actual referrer. If not (direct
 * deep-link, bookmark, share URL), fall back to /library so the link
 * still does something useful.
 */
export function BackLink({ label, fallbackHref }: { label: string; fallbackHref: string }) {
  const router = useRouter();
  return (
    <Link
      href={fallbackHref}
      className="text-xs text-neutral-500 hover:text-white"
      onClick={(e) => {
        // window.history.length > 1 means "we got here via at least one
        // in-app navigation"; that's the case we want router.back() for.
        // Direct entry (length === 1) keeps the href as the fallback so
        // the link isn't a dead click.
        if (typeof window !== "undefined" && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {label}
    </Link>
  );
}
