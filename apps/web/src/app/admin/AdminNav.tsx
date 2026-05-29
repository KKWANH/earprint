import Link from "next/link";

/**
 * R36 — shared sub-nav across the /admin/* pages. Renders as a
 * thin pill row at the top of every admin page so the operator
 * doesn't have to manually type each URL. Server component
 * (no client state needed) — just static links.
 *
 * Each admin page imports + renders it directly inside its main.
 * The `active` prop highlights the current entry.
 */
const ADMIN_LINKS = [
  { href: "/admin/jobs",            label: "Jobs",            key: "jobs" },
  { href: "/admin/cache",           label: "Cache",           key: "cache" },
  { href: "/admin/genre-requests",  label: "Genre requests",  key: "genre-requests" },
] as const;

export type AdminNavKey = (typeof ADMIN_LINKS)[number]["key"];

export function AdminNav({ active }: { active: AdminNavKey }) {
  return (
    <nav className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-[10px] uppercase tracking-wider text-neutral-600">
        admin
      </span>
      {ADMIN_LINKS.map((l) => {
        const isActive = l.key === active;
        return (
          <Link
            key={l.key}
            href={l.href}
            className={`rounded-full border px-2.5 py-0.5 transition-colors ${
              isActive
                ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                : "border-white/10 bg-black/30 text-neutral-400 hover:border-emerald-500/40 hover:text-neutral-200"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
