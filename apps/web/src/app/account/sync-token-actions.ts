"use server";

import { revalidatePath } from "next/cache";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";
import { generateSyncToken, hashSyncToken } from "@/lib/tokens";

/**
 * Issues a fresh sync token and invalidates the previous one in the same
 * UPDATE — there's no overlap window. Used when the user suspects their
 * extension install was on a shared/lost machine or just wants a fresh
 * pairing. The Chrome extension's connect.ts content script will pick up
 * the new token automatically on the user's next visit to /connect.
 *
 * Writes BOTH the plaintext column (transition mode) AND the hash so
 * the new token verifies against either lookup path. Once the
 * plaintext column gets dropped (separate commit, after every active
 * row has a hash), this can write hash-only.
 */
export async function rotateSyncToken() {
  const { userId } = await ensureConnection();
  const sql = getSql();
  const fresh = generateSyncToken();
  const hash = await hashSyncToken(fresh);
  await sql`
    UPDATE users
       SET sync_token      = ${fresh},
           sync_token_hash = ${hash},
           updated_at      = now()
     WHERE id = ${userId}`;
  revalidatePath("/account");
  revalidatePath("/connect");
}
