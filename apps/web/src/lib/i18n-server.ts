import { cookies } from "next/headers";
import type { Locale } from "./i18n";

/** Reads the locale cookie (English is the default). Server components only. */
export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  return c.get("locale")?.value === "ko" ? "ko" : "en";
}
