import { redirect } from "next/navigation";
import { ensureConnection, type Connection } from "./connection";

/**
 * Wraps ensureConnection() with a redirect to /onboarding when the user
 * hasn't yet accepted the current ToS + confirmed they are 16+. Used by
 * every authenticated page except /onboarding itself and /account
 * (the latter must stay reachable so users can sign out or delete
 * their account without first re-consenting).
 */
export async function requireOnboarded(): Promise<Connection> {
  const conn = await ensureConnection();
  if (!conn.onboarded) redirect("/onboarding");
  return conn;
}
