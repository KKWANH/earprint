"use server";

import { signOut } from "@/auth";
import { ensureConnection } from "@/lib/connection";
import { getSql } from "@/lib/db";

/**
 * Permanently deletes the signed-in user. The users-row delete cascades to
 * every user-owned table (liked tracks, analysis, recommendations, profile,
 * jobs, affinity). Sign-out follows so the JWT can't re-create the row.
 */
export async function deleteAccount() {
  const { userId } = await ensureConnection();
  await getSql()`DELETE FROM users WHERE id = ${userId}`;
  await signOut({ redirectTo: "/" });
}
