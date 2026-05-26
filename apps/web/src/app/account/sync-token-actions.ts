"use server";

import { revalidatePath } from "next/cache";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { generateSyncToken } from "@/lib/tokens";

/**
 * Issues a fresh sync token and invalidates the previous one in the same
 * UPDATE — there's no overlap window. Used when the user suspects their
 * extension install was on a shared/lost machine or just wants a fresh
 * pairing. The Chrome extension's connect.ts content script will pick up
 * the new token automatically on the user's next visit to /connect.
 */
export async function rotateSyncToken() {
  const { userId } = await ensureConnection();
  const sql = getSql();
  const fresh = generateSyncToken();
  await sql`
    UPDATE users
       SET sync_token = ${fresh},
           updated_at = now()
     WHERE id = ${userId}`;
  revalidatePath("/account");
  revalidatePath("/connect");
}
