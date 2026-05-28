/**
 * Seeds apps/web/src/data/genre-content.ts with Gemini-generated
 * editorial entries (emoji + era + origin + 2-3 sentence history,
 * KO + EN) for the top N genres in the live DB by user-track count.
 *
 * Idempotent: any genre already present in the existing TS file is
 * skipped. New entries are appended into a single output block that
 * the script writes to stdout — pipe / paste it into the file and
 * review the diff before committing. We don't auto-edit the TS file
 * because Gemini output for niche genres can be wrong and the
 * editorial layer is curation-grade.
 *
 * Usage:
 *   DATABASE_URL=...  \
 *   GEMINI_API_KEY=... \
 *   node apps/web/scripts/seed-genre-content.mjs [topN]
 *
 *   - DATABASE_URL: the production Neon URL (or a branch). Read-only;
 *     this script does not write to the DB.
 *   - GEMINI_API_KEY: the same key wired up to /api/genre/warm.
 *   - topN (optional, default 50): how many genres to consider.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

neonConfig.webSocketConstructor = WebSocket;

const url = process.env.DATABASE_URL;
const apiKey = process.env.GEMINI_API_KEY;
if (!url || !apiKey) {
  console.error(
    "usage: DATABASE_URL=... GEMINI_API_KEY=... node apps/web/scripts/seed-genre-content.mjs [topN]",
  );
  process.exit(1);
}
// Same placeholder guard as apply-schema.mjs — turns the otherwise
// opaque WebSocket ErrorEvent into something actionable.
if (url.includes("...") || url.includes("<") || !url.startsWith("postgres")) {
  console.error(
    "❌ DATABASE_URL looks like a placeholder, not a real URL.",
    "\n   Got:", url.slice(0, 80),
    "\n   Get the actual URL from Neon dashboard → Connection Details → Pooled connection.",
  );
  process.exit(1);
}
if (apiKey.includes("...") || apiKey.startsWith("<") || apiKey.length < 20) {
  console.error(
    "❌ GEMINI_API_KEY looks like a placeholder. Get a real key at aistudio.google.com → API keys.",
  );
  process.exit(1);
}
const topN = Number.parseInt(process.argv[2] ?? "50", 10);
if (!Number.isFinite(topN) || topN < 1 || topN > 500) {
  console.error("topN out of range (1-500)");
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentTsPath = resolve(__dirname, "../src/data/genre-content.ts");

// Parse out the lowercase keys already present in the TS file so we
// don't double-seed. We're not parsing the TS — just grepping for
// '"<key>":' at the start of an entry. False positives are rare and
// the worst case is a wasted Gemini call.
const existingKeys = (() => {
  let src = "";
  try {
    src = readFileSync(contentTsPath, "utf8");
  } catch (e) {
    console.error(`couldn't read ${contentTsPath}:`, e?.message ?? e);
    process.exit(1);
  }
  const keys = new Set();
  const re = /^\s*"([^"]+)":\s*\{/gm;
  let m;
  while ((m = re.exec(src)) !== null) keys.add(m[1].toLowerCase());
  return keys;
})();

// Top-N genres by total user-track count. analysis.genres is a JSONB
// {<genre>: <score>} map — unfurl with jsonb_object_keys, group, count.
const pool = new Pool({ connectionString: url });
let rows;
try {
  const res = await pool.query(
    `SELECT lower(k.key) AS genre, count(*)::int AS n
       FROM analysis a
       CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
       WHERE a.genres IS NOT NULL
       GROUP BY lower(k.key)
       ORDER BY n DESC
       LIMIT $1`,
    [topN],
  );
  rows = res.rows;
} finally {
  await pool.end();
}

const todo = rows
  .map((r) => r.genre.trim())
  .filter((g) => g && !existingKeys.has(g));

if (todo.length === 0) {
  console.error(`all ${rows.length} top-${topN} genres already seeded; nothing to do.`);
  process.exit(0);
}

console.error(
  `seeding ${todo.length} genres (out of top ${rows.length}; ${existingKeys.size} already covered):`,
);
for (const g of todo) console.error(`  - ${g}`);
console.error("");

// Gemini prompt — explicit structured JSON output so we can paste
// straight into the TS file. Bilingual; era/origin must be short.
const SCHEMA = {
  type: "OBJECT",
  properties: {
    emoji: { type: "STRING" },
    eraEn: { type: "STRING" },
    eraKo: { type: "STRING" },
    originEn: { type: "STRING" },
    originKo: { type: "STRING" },
    historyEn: { type: "STRING" },
    historyKo: { type: "STRING" },
  },
  required: ["emoji", "historyEn", "historyKo"],
};

async function gemini(genre) {
  const prompt =
    `Write editorial content about the music genre "${genre}".\n` +
    `- emoji: ONE single emoji that represents the genre. No skin tones or compound ZWJ.\n` +
    `- eraEn / eraKo: short era label like "1970s — today" or "1992 — today".\n` +
    `- originEn / originKo: short cultural origin like "South Korea" or "South Bronx, New York".\n` +
    `- historyEn: 2-3 sentences. Origin story → key turning point → why it sounds the way it does today. No Wikipedia-style padding.\n` +
    `- historyKo: same content, natural Korean. Concise, not literal translation.\n` +
    `If "${genre}" is not actually a music genre (e.g. an album name, a non-music tag), return empty strings for all fields.`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA },
  };
  // gemini-2.0-flash-lite was deprecated for new API keys in 2026;
  // 2.5-flash-lite is the drop-in replacement (same JSON-mode shape,
  // same throughput tier). Override via env if you have an older
  // grandfathered key + want to pin to 2.0.
  const model = process.env.GEMINI_MODEL_SEED ?? "gemini-2.5-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const d = await res.json();
  const text = d?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("no gemini text");
  return JSON.parse(text);
}

// Output one entry block per genre. Pasteable directly into GENRE_CONTENT.
function entryBlock(key, c) {
  const e = (s) => (s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const lines = [`  "${key}": {`];
  lines.push(`    emoji: "${e(c.emoji)}",`);
  if (c.eraEn) lines.push(`    eraEn: "${e(c.eraEn)}",`);
  if (c.eraKo) lines.push(`    eraKo: "${e(c.eraKo)}",`);
  if (c.originEn) lines.push(`    originEn: "${e(c.originEn)}",`);
  if (c.originKo) lines.push(`    originKo: "${e(c.originKo)}",`);
  lines.push(`    historyEn:`);
  lines.push(`      "${e(c.historyEn)}",`);
  lines.push(`    historyKo:`);
  lines.push(`      "${e(c.historyKo)}",`);
  lines.push(`  },`);
  return lines.join("\n");
}

const blocks = [];
for (const g of todo) {
  process.stderr.write(`  → ${g} ... `);
  try {
    const c = await gemini(g);
    if (!c.emoji || !c.historyEn || !c.historyKo) {
      process.stderr.write("skipped (Gemini judged not-a-genre)\n");
      continue;
    }
    blocks.push(entryBlock(g, c));
    process.stderr.write("ok\n");
  } catch (e) {
    process.stderr.write(`failed: ${e?.message ?? e}\n`);
  }
  // Light throttle — 60 calls/min limit on flash-lite. Keeps us safe.
  await new Promise((r) => setTimeout(r, 1100));
}

if (blocks.length === 0) {
  console.error("\nno new entries to emit.");
  process.exit(0);
}

// Final output to stdout — pipe or paste this into the TS file.
process.stdout.write(
  `\n// ─── seeded by scripts/seed-genre-content.mjs on ${new Date().toISOString().slice(0, 10)} ───\n`,
);
process.stdout.write(blocks.join("\n") + "\n");
console.error(`\nemitted ${blocks.length} entries on stdout.`);
console.error(
  `paste them into the GENRE_CONTENT block in apps/web/src/data/genre-content.ts,\n` +
    `then review + commit the diff.`,
);
