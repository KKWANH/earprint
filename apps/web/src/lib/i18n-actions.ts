"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALES, type Locale } from "./i18n";

/**
 * Sets the UI language. Writing the cookie server-side (not via
 * document.cookie) is authoritative — it survives refreshes and both
 * switch directions work reliably.
 */
export async function setLocale(locale: Locale): Promise<void> {
  const value: Locale = LOCALES.includes(locale) ? locale : "en";
  const c = await cookies();
  c.set("locale", value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
