/**
 * db/schema.sql 을 Neon Postgres 에 적용한다 (psql 없이).
 * 사용: DATABASE_URL=... node scripts/apply-schema.mjs ../../db/schema.sql
 */
import { readFileSync } from "node:fs";
import { Pool, neonConfig } from "@neondatabase/serverless";

// Node 21+ 의 전역 WebSocket 사용 (neon Pool 은 WebSocket 위에서 동작).
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
  await pool.query(sql); // simple query protocol — 다중 statement 허용
  console.log("✅ schema applied");
} catch (err) {
  console.error("❌ failed:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
