"use server";

import { revalidatePath } from "next/cache";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";

/** Toggles ai_consent_at on the signed-in user. Setting to NULL revokes
 *  consent → subsequent AI profile generations are refused. */
export async function setAiConsent(grant: boolean) {
  const { userId } = await ensureConnection();
  const sql = getSql();
  await sql`
    UPDATE users
       SET ai_consent_at = ${grant ? new Date().toISOString() : null},
           updated_at    = now()
     WHERE id = ${userId}`;
  revalidatePath("/account");
}
