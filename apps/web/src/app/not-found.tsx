import Link from "next/link";
import { dicts } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

/** App-wide 404 page. Replaces the default Next not-found screen. */
export default async function NotFound() {
  const locale = await getLocale();
  const t = dicts[locale].errors;
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <p className="font-serif text-6xl text-neutral-700">404</p>
      <h1 className="text-xl font-bold">{t.notFoundTitle}</h1>
      <p className="text-sm text-neutral-400">{t.notFoundBody}</p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-white px-5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-200"
      >
        {t.home}
      </Link>
    </main>
  );
}
