/**
 * Applies db/schema.sql to Neon Postgres (without psql).
 * Usage: DATABASE_URL=... node scripts/apply-schema.mjs ../../db/schema.sql
 */
import { readFileSync } from "node:fs";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Use the global WebSocket from Node 21+ (neon Pool runs over WebSocket).
neonConfig.webSocketConstructor = WebSocket;

const url = process.env.DATABASE_URL;
const file = process.argv[2];
if (!url || !file) {
  console.error("usage: DATABASE_URL=... node scripts/apply-schema.mjs <schema.sql>");
  process.exit(1);
}

// Reject obvious placeholders early. Easy to copy-paste the doc
// snippet ("postgresql://...실제값...") verbatim and get an opaque
// WebSocket error from inside the driver instead of an actionable
// hint. Catch it here.
if (url.includes("...") || url.includes("<") || !url.startsWith("postgres")) {
  console.error(
    "❌ DATABASE_URL looks like a placeholder, not a real URL.",
    "\n   Got:", url.slice(0, 80),
    "\n   Expected something like:",
    "\n   postgresql://neondb_owner:<pwd>@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require",
    "\n",
    "\n   Get the actual URL from Neon dashboard → Connection Details → Pooled connection.",
  );
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const pool = new Pool({ connectionString: url });
try {
  await pool.query(sql); // simple query protocol — allows multiple statements
  console.log("✅ schema applied");
} catch (err) {
  // ErrorEvent (WebSocket failures) doesn't expose .message — dig
  // through whatever shape neon's wrapper gave us. Always print
  // something the human can act on instead of an empty error line.
  const reason =
    err?.message ||
    err?.error?.message ||
    err?.cause?.message ||
    err?.code ||
    (typeof err === "string" ? err : null) ||
    JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}), 2);
  console.error("❌ failed:", reason);
  if (err?.code === "ENOTFOUND" || /websocket/i.test(String(reason))) {
    console.error(
      "\n   Looks like a network / hostname failure — most often the",
      "\n   DATABASE_URL has the wrong host or is missing ?sslmode=require.",
    );
  }
  process.exitCode = 1;
} finally {
  await pool.end();
}
