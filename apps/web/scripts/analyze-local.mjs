/**
 * Local analysis runner — runs the whole pipeline on YOUR machine, $0 API cost.
 *
 *   Phase 1  enrich  — Deezer (free, no key): album / preview / match
 *   Phase 2  AI      — a LOCAL model (Qwen via Ollama / LM Studio): genres,
 *                      moods, energy/tempo/acousticness, instruments
 *
 * This replaces the paid Gemini step. The cloud worker is left untouched —
 * just don't press "분석 시작" on the web; run this instead.
 *
 * ── Setup ────────────────────────────────────────────────────────────
 *   1. Run a local model. With Ollama:   ollama run qwen2.5
 *      (check the exact name with `ollama list`)
 *   2. DATABASE_URL must be set — it already lives in apps/web/.dev.vars.
 *
 * ── Run ──────────────────────────────────────────────────────────────
 *   pnpm --filter web analyze:local
 *
 * ── Env (all optional except DATABASE_URL) ───────────────────────────
 *   DATABASE_URL    Neon connection string
 *   LOCAL_AI_URL    OpenAI-compatible base URL
 *                   Ollama   → http://localhost:11434/v1  (default)
 *                   LM Studio→ http://localhost:1234/v1
 *   LOCAL_AI_MODEL  model name (default: qwen2.5)
 *   AI_BATCH        tracks per model call (default: 6)
 */
import { Pool, neonConfig } from "@neondatabase/serverless";

neonConfig.webSocketConstructor = WebSocket;

const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("❌ DATABASE_URL 가 없습니다. apps/web/.dev.vars 에 설정하세요.");
  process.exit(1);
}
const AI_URL = (process.env.LOCAL_AI_URL || "http://localhost:11434/v1").replace(/\/+$/, "");
const AI_MODEL = process.env.LOCAL_AI_MODEL || "qwen3:8b";
const ENRICH_BATCH = 24;
const AI_BATCH = Math.max(1, Number(process.env.AI_BATCH || 6));

const pool = new Pool({ connectionString: DB });
const q = (text, params) => pool.query(text, params);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Deezer (free) ────────────────────────────────────────────────────
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\bfeat\.?.*$/i, " ")
    .replace(/[^a-z0-9가-힣ぁ-んァ-ヶ一-龯]+/gi, " ")
    .trim();
}
function scoreMatch(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0.4;
  if (x === y) return 0.95;
  if (x.includes(y) || y.includes(x)) return 0.75;
  return 0.5;
}
function yearOf(date) {
  const m = typeof date === "string" ? date.match(/^(\d{4})/) : null;
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= new Date().getFullYear() + 1 ? y : null;
}
async function deezerTrackMeta(id) {
  try {
    const r = await fetch(`https://api.deezer.com/track/${id}`);
    const t = await r.json();
    // Deezer error payload (rate limit) ⇒ not a real "no date" answer.
    if (t?.error) return { ok: false, year: null, rank: null };
    return {
      ok: true,
      year: yearOf(t?.release_date) ?? yearOf(t?.album?.release_date),
      rank: typeof t?.rank === "number" ? t.rank : null,
    };
  } catch {
    return { ok: false, year: null, rank: null };
  }
}
async function searchDeezer(artist, title) {
  const empty = {
    deezerId: null,
    album: null,
    previewUrl: null,
    releaseYear: null,
    rank: null,
    bpm: null,
    genres: null,
    moods: null,
    matchConfidence: 0,
  };
  const ct = norm(title) || title;
  const adv = `artist:"${String(artist).replace(/"/g, "")}" track:"${ct}"`;
  let hit;
  try {
    let r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(adv)}&limit=1`);
    hit = (await r.json())?.data?.[0];
    if (!hit) {
      r = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=1`,
      );
      hit = (await r.json())?.data?.[0];
    }
  } catch {
    return empty;
  }
  if (!hit) return empty;
  const meta = hit.id ? await deezerTrackMeta(hit.id) : { year: null, rank: null };
  return {
    deezerId: hit.id ?? null,
    album: hit.album?.title ?? null,
    previewUrl: hit.preview || null,
    releaseYear: meta.year,
    rank: meta.rank ?? (typeof hit.rank === "number" ? hit.rank : null),
    bpm: null,
    genres: null,
    moods: null,
    matchConfidence: scoreMatch(title, hit.title ?? ""),
  };
}

// ── Local AI (OpenAI-compatible chat completions) ────────────────────
const PROMPT_HEAD = `너는 음악 분석가다. 아래 곡들을 분석해 **JSON만** 출력하라. 형식:
{"results":[{"id":"<대괄호 안 값>","genres":["..."],"moods":["..."],"energy":0.0,"tempo":0.0,"acousticness":0.0,"instruments":["..."]}]}

각 곡 규칙:
- genres: 곡/앨범의 실제 특성을 반영한 구체적 하위장르 2~5개 (영문 소문자: shoegaze, city pop, neo-soul 등). 아티스트 일반 장르로 뭉뚱그리지 말 것.
- moods: 정서 1~3개 (영문 소문자: melancholic, dreamy, energetic 등).
- energy: 0(차분·조용) ~ 1(격렬·시끄러움)
- tempo: 0(느림) ~ 1(빠름)
- acousticness: 0(전자음 중심) ~ 1(생악기 중심)
- instruments: 두드러진 악기·음색 2~4개 (영문 소문자)
- 모르는 곡은 genres·moods 빈 배열, 수치 0.5.
- id 는 입력 대괄호 안 값을 그대로.
JSON 외의 어떤 텍스트도 출력하지 말 것.

곡 목록:`;

async function callLocalAi(list) {
  const res = await fetch(`${AI_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "user", content: `${PROMPT_HEAD}\n${list}` }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      stream: false,
    }),
    signal: AbortSignal.timeout(240000),
  });
  if (!res.ok) {
    throw new Error(`local AI HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  let text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("local AI 응답이 비어 있습니다");
  // Qwen3 emits a <think> reasoning block — strip it before parsing JSON.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Models may still wrap JSON in prose / code fences — extract the object.
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text);
}

function toObj(arr, maxLen) {
  const o = {};
  if (Array.isArray(arr)) {
    for (const x of arr) {
      const k = String(x ?? "").toLowerCase().trim();
      if (k && k.length <= maxLen) o[k] = 1;
    }
  }
  return o;
}
const clamp01 = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
};

// ── Phase 1: enrich ──────────────────────────────────────────────────
async function enrichPhase() {
  let done = 0;
  for (;;) {
    const { rows } = await q(
      `SELECT t.id, t.title, t.artist
       FROM tracks t
       JOIN user_tracks ut ON ut.track_id = t.id
       LEFT JOIN analysis a ON a.track_id = t.id AND a.analysis_version = 1
       WHERE a.id IS NULL
       GROUP BY t.id, t.title, t.artist
       LIMIT ${ENRICH_BATCH}`,
    );
    if (rows.length === 0) break;
    const out = [];
    for (const t of rows) {
      out.push({ trackId: t.id, ...(await searchDeezer(t.artist, t.title)) });
    }
    await q("SELECT save_enrichments($1::jsonb)", [JSON.stringify(out)]);
    done += rows.length;
    process.stdout.write(`\r  1/2 보강(Deezer): ${done}곡`);
  }
  if (done) console.log();
  return done;
}

// ── Backfill: release year + popularity for tracks enriched before ──
// (the reminiscence-bump / novelty analyses need these)
async function backfillPhase() {
  let done = 0;
  let stall = 0;
  for (;;) {
    const { rows } = await q(
      `SELECT t.id, t.deezer_id
       FROM tracks t
       JOIN user_tracks ut ON ut.track_id = t.id
       WHERE t.deezer_id IS NOT NULL AND t.release_year IS NULL
       GROUP BY t.id, t.deezer_id
       LIMIT 15`,
    );
    if (rows.length === 0) break;
    const out = [];
    for (const t of rows) {
      const meta = await deezerTrackMeta(t.deezer_id);
      // Skip fetch failures (stay NULL → retried); 0 = genuinely no date.
      if (meta.ok) out.push({ trackId: t.id, releaseYear: meta.year ?? 0, rank: meta.rank });
    }
    if (out.length > 0) {
      await q("SELECT save_track_meta($1::jsonb)", [JSON.stringify(out)]);
      done += out.length;
      stall = 0;
    } else {
      // whole batch failed (Deezer throttling) — back off, then give up
      if (++stall >= 6) {
        console.log("\n  ⚠ Deezer 응답이 계속 실패해 발매연도 보강을 멈춥니다 (나중에 재시도).");
        break;
      }
      await sleep(3000);
    }
    process.stdout.write(`\r  발매연도 보강: ${done}곡`);
    await sleep(700); // spaced — stay under Deezer's rate limit
  }
  if (done) console.log();
  return done;
}

// ── Phase 2: AI analysis (local model) ───────────────────────────────
async function aiPhase() {
  const { rows: c } = await q(
    `SELECT count(*)::int AS n FROM analysis
     WHERE analysis_version = 1 AND audio_feel IS NULL`,
  );
  let remaining = c[0].n;
  if (remaining === 0) return 0;

  let done = 0;
  let consecutiveFails = 0;
  for (;;) {
    const { rows } = await q(
      `SELECT t.id, t.title, t.artist
       FROM analysis a
       JOIN tracks t ON t.id = a.track_id
       JOIN user_tracks ut ON ut.track_id = a.track_id
       WHERE a.analysis_version = 1 AND a.audio_feel IS NULL
       GROUP BY t.id, t.title, t.artist
       LIMIT ${AI_BATCH}`,
    );
    if (rows.length === 0) break;

    const list = rows.map((t) => `[${t.id}] ${t.artist} — ${t.title}`).join("\n");
    let parsed = null;
    for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
      try {
        parsed = await callLocalAi(list);
      } catch (e) {
        if (attempt === 2) console.error(`\n  ⚠ 배치 실패: ${e.message}`);
        else await sleep(1500 * (attempt + 1));
      }
    }

    const byId = new Map();
    for (const r of parsed?.results ?? []) {
      if (r?.id) byId.set(String(r.id), r);
    }
    // Fallback (0.5 / empty) when the model omitted a track — keeps the row
    // from being re-picked forever.
    const out = rows.map((t) => {
      const r = byId.get(String(t.id));
      return {
        trackId: t.id,
        genres: toObj(r?.genres, 28),
        moods: toObj(r?.moods, 20),
        audioFeel: {
          energy: clamp01(r?.energy),
          tempo: clamp01(r?.tempo),
          acousticness: clamp01(r?.acousticness),
          instruments: Array.isArray(r?.instruments)
            ? r.instruments
                .map((x) => String(x ?? "").toLowerCase().trim())
                .filter((x) => x && x.length <= 24)
                .slice(0, 4)
            : [],
        },
      };
    });
    await q("SELECT save_ai_analysis($1::jsonb)", [JSON.stringify(out)]);
    done += rows.length;
    process.stdout.write(`\r  2/2 AI 분석(${AI_MODEL}): ${done}/${remaining}곡`);

    consecutiveFails = parsed ? 0 : consecutiveFails + 1;
    if (consecutiveFails >= 6) {
      console.error(
        `\n❌ 로컬 AI 가 계속 실패합니다. 모델이 실행 중인지 확인하세요 (LOCAL_AI_URL=${AI_URL}).`,
      );
      break;
    }
  }
  console.log();
  return done;
}

// ── Health check ─────────────────────────────────────────────────────
async function checkLocalAi() {
  try {
    const res = await fetch(`${AI_URL}/models`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const names = (data?.data ?? []).map((m) => m.id);
    console.log(`✅ 로컬 AI 연결됨 (${AI_URL}) — 모델 ${names.length}개`);
    if (names.length && !names.some((n) => n.includes(AI_MODEL.split(":")[0]))) {
      console.log(
        `⚠ "${AI_MODEL}" 가 목록에 없습니다. 사용 가능: ${names.join(", ")}\n` +
          `   LOCAL_AI_MODEL 환경변수로 정확한 이름을 지정하세요.`,
      );
    }
    return true;
  } catch (e) {
    console.error(
      `❌ 로컬 AI 에 연결 못함 (${AI_URL}): ${e.message}\n` +
        `   Ollama 라면 'ollama serve' 가 떠 있는지, 모델이 받아져 있는지 확인하세요.`,
    );
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────
try {
  console.log("🎧 로컬 분석 시작 — Deezer 보강 + 로컬 모델 분석 (API 비용 0원)\n");
  await enrichPhase();
  await backfillPhase();
  if (!(await checkLocalAi())) process.exit(1);
  await aiPhase();

  const { rows } = await q(
    `SELECT count(*)::int AS analyzed,
            count(*) FILTER (WHERE audio_feel IS NULL)::int AS pending
     FROM analysis WHERE analysis_version = 1`,
  );
  // Reflect completion in the web UI so it shows "완료".
  await q(
    "UPDATE background_jobs SET status='done', updated_at=now() WHERE kind='analyze' AND status='running'",
  );
  console.log(
    `\n✅ 완료 — 분석된 곡 ${rows[0].analyzed}곡` +
      (rows[0].pending ? ` (남은 ${rows[0].pending}곡은 재실행하면 이어집니다)` : ""),
  );
} catch (err) {
  console.error("❌ 실패:", err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
