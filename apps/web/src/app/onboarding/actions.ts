"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { CURRENT_TOS_VERSION } from "@/lib/constants";
import { getSql } from "@/lib/db";

/**
 * Records the user's onboarding consents. Server action — invoked from the
 * /onboarding form. The Age + ToS checkboxes are required; the AI consent
 * is optional (NULL means opted out).
 */
export async function saveConsent(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  const age = formData.get("age") === "on";
  const tos = formData.get("tos") === "on";
  const ai = formData.get("ai") === "on";

  if (!age || !tos) {
    // The form prevents this client-side, but server-side check too in
    // case someone POSTs directly.
    redirect("/onboarding?error=required");
  }

  const { userId } = await ensureConnection();
  const sql = getSql();
  await sql`
    UPDATE users
       SET tos_accepted_at  = now(),
           tos_version      = ${CURRENT_TOS_VERSION},
           age_confirmed_at = now(),
           ai_consent_at    = ${ai ? new Date().toISOString() : null},
           last_seen_at     = now(),
           updated_at       = now()
     WHERE id = ${userId}`;
  redirect("/library");
}
