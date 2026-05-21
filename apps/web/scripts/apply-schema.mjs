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

const sql = readFileSync(file, "utf8");
const pool = new Pool({ connectionString: url });
try {
  await pool.query(sql); // simple query protocol — allows multiple statements
  console.log("✅ schema applied");
} catch (err) {
  console.error("❌ failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
