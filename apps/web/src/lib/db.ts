import { neon } from "@neondatabase/serverless";

/**
 * Neon Postgres (serverless) connection.
 * HTTP-based, so it works in the Cloudflare Workers runtime.
 * Returns a tagged-template query function: sql`SELECT ...`
 */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}
