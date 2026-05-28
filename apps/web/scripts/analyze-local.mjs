/**
 * Local analysis runner — Phase 1 enrich (Deezer) + Phase 2 AI analysis.
 *
 * Phase 2 races up to two providers per batch (Promise.any — first valid
 * response wins, others discarded):
 *   • Local  (Ollama Qwen)   — free but slow
 *   • Gemini (cloud)          — ~$0.0007/batch, fastest
 * Whichever responds first is what gets saved. Providers without keys
 * (or in AI_DISABLE) are silently skipped.
 *
 * Kimi (Moonshot) was removed: China-based hosting fails the GDPR
 * cross-border transfer test for EU users without a workable mechanism.
 *
 * ── Run ──────────────────────────────────────────────────────────────
 *   pnpm --filter web analyze:local
 *
 * ── Env (all optional except DATABASE_URL) ───────────────────────────
 *   DATABASE_URL    Neon connection string
 *   LOCAL_AI_URL    OpenAI-compatible base URL
 *                   Ollama   → http://localhost:11434/v1  (default)
 *   LOCAL_AI_MODEL  model name (default: qwen3:8b)
 *   GEMINI_API_KEY  Cloud Gemini key — enables Gemini in the race
 *   GEMINI_MODEL    default gemini-2.0-flash
 *   AI_BATCH        tracks per model call (default: 6)
 *   AI_DISABLE      'local' | 'gemini' to opt one out
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
    // Release year is left to backfill:years (MusicBrainz) — Deezer's date is
    // the remaster edition's, which corrupts the reminiscence-bump analysis.
    releaseYear: null,
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

function parseLooseJson(text) {
  // Qwen3 emits a <think> reasoning block — strip it before parsing JSON.
  text = String(text).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Models may wrap JSON in prose / code fences — extract the first object.
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text);
}

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
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("local AI 응답이 비어 있습니다");
  return parseLooseJson(text);
}

async function callGemini(list) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no GEMINI_API_KEY");
  // flash-lite is the cheapest tier — track analysis is structured JSON
  // for 6 tracks per call, the quality gap vs flash is negligible.
  // Bumped 2.0 → 2.5 in R25b — 2.0 line deprecated for new API keys.
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${PROMPT_HEAD}\n${list}` }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다");
  return parseLooseJson(text);
}

/**
 * Fires every enabled provider in parallel and returns the first valid
 * response (Promise.any). Per-provider keys gate participation; AI_DISABLE
 * can opt one out manually. The winning provider's name is bubbled up so
 * progress can show the split.
 */
async function callRace(list) {
  const disabled = new Set((process.env.AI_DISABLE || "").split(/[,\s]+/).filter(Boolean));
  const tag = (name, p) => p.then((r) => ({ name, r }));
  const candidates = [];
  if (!disabled.has("local")) candidates.push(tag("local", callLocalAi(list)));
  if (process.env.GEMINI_API_KEY && !disabled.has("gemini")) {
    candidates.push(tag("gemini", callGemini(list)));
  }
  if (candidates.length === 0) throw new Error("AI 공급자가 하나도 활성화되지 않음");
  try {
    return await Promise.any(candidates);
  } catch (e) {
    if (e instanceof AggregateError) {
      throw new Error(e.errors.map((x) => x.message).join(" · "));
    }
    throw e;
  }
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
  // Per-provider counters for the closing summary.
  const wins = { local: 0, gemini: 0 };
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
    let winner = null;
    for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
      try {
        const w = await callRace(list);
        parsed = w.r;
        winner = w.name;
      } catch (e) {
        if (attempt === 2) console.error(`\n  ⚠ 배치 실패: ${e.message}`);
        else await sleep(1500 * (attempt + 1));
      }
    }
    if (winner) wins[winner] = (wins[winner] || 0) + 1;

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
    const splitParts = Object.entries(wins)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k} ×${v}`)
      .join(" · ");
    process.stdout.write(
      `\r  2/2 AI race: ${done}/${remaining}곡 (${splitParts || "—"})  `,
    );

    consecutiveFails = parsed ? 0 : consecutiveFails + 1;
    if (consecutiveFails >= 6) {
      console.error(
        `\n❌ 모든 AI 공급자가 6배치 연속 실패. 로컬 (${AI_URL}) 또는 GEMINI_API_KEY 셋업 확인.`,
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
  const enabled = [];
  const disabled = new Set((process.env.AI_DISABLE || "").split(/[,\s]+/).filter(Boolean));
  if (!disabled.has("local")) enabled.push("local");
  if (process.env.GEMINI_API_KEY && !disabled.has("gemini")) enabled.push("gemini");
  console.log(
    `🎧 분석 시작 — Deezer 보강 + AI race (${enabled.join(" + ") || "none"})\n`,
  );
  await enrichPhase();

  // Local being down is fine when at least one cloud provider is configured.
  const localOk = !disabled.has("local") ? await checkLocalAi() : false;
  const cloudCount = enabled.filter((p) => p !== "local").length;
  if (!localOk && cloudCount === 0) {
    console.error("❌ AI 공급자가 없음 — 로컬 다운 + 클라우드 키 미설정.");
    process.exit(1);
  }
  if (!localOk && cloudCount > 0) {
    console.log("⚠ 로컬은 건너뛰고 클라우드만 사용합니다.");
  }
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
