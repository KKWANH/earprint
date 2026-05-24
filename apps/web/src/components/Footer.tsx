import Link from "next/link";
import { dicts, type Locale } from "@/lib/i18n";

/** Site footer — brand mark and links to the legal pages. */
export function Footer({ locale }: { locale: Locale }) {
  const t = dicts[locale].footer;
  return (
    <footer className="mt-auto border-t border-white/10 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-4 w-4" />
          <span className="font-semibold text-neutral-300">Earprint</span>
          <span className="text-neutral-700">·</span>
          <span className="text-xs text-neutral-600">{t.tagline}</span>
        </div>
        <nav className="flex items-center gap-4 text-xs text-neutral-500">
          <Link href="/guide" className="hover:text-white">
            {t.guide}
          </Link>
          <Link href="/privacy" className="hover:text-white">
            {t.privacy}
          </Link>
          <Link href="/terms" className="hover:text-white">
            {t.terms}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
