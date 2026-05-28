import { z } from "zod";
import { aiJson } from "./ai";
import { findGenre } from "./genreDict";

/**
 * Per-track Gemini output runtime check. Coerce numbers and clamp arrays
 * so a malformed batch (e.g. `energy: "0.5"` instead of 0.5) becomes a
 * partial-skip rather than a thrown error — the toObj/clamp01 helpers
 * below already tolerate odd values, this Zod just enforces *structure*
 * so we never silently miss the top-level `results` array.
 *
 * The schema accepts both the legacy shape (just `genres` + `moods`) AND
 * the new multi-label fields (primaryGenre, subGenres, styleTags,
 * regionTags, eraTags). New fields are optional so a Gemini response
 * that omits them (e.g. a model that didn't honour the updated prompt)
 * still parses cleanly — the row just lands without the extra signal.
 */
const AnalyzeRowZ = z.object({
  id: z.string().min(1),
  genres: z.array(z.unknown()).optional(),
  moods: z.array(z.unknown()).optional(),
  energy: z.coerce.number().optional(),
  tempo: z.coerce.number().optional(),
  acousticness: z.coerce.number().optional(),
  instruments: z.array(z.unknown()).optional(),
  realArtist: z.string().optional(),
  realTitle: z.string().optional(),
  // ── Multi-label (May 2026) ──
  primaryGenre: z.string().optional(),
  subGenres: z.array(z.unknown()).optional(),
  styleTags: z.array(z.unknown()).optional(),
  regionTags: z.array(z.unknown()).optional(),
  eraTags: z.array(z.unknown()).optional(),
});
const AnalyzeBatchZ = z.object({
  results: z.array(AnalyzeRowZ).default([]),
});

/** Unified Gemini analysis — refined genres/moods + audio feel, per track. */
export interface AiAnalysisInput {
  id: string;
  artist: string;
  title: string;
}
export interface AiAnalysisRow {
  trackId: string;
  /** Legacy flat-map. Still written for backward compat — every caller
   *  that reads `analysis.genres` keeps working until migrated. */
  genres: Record<string, number>;
  moods: Record<string, number>;
  audioFeel: {
    energy: number;
    tempo: number;
    acousticness: number;
    instruments: string[];
  };
  realArtist: string; // "" = no change
  realTitle: string;
  /** Multi-label, canonicalised against genreDict. Empty string for
   *  primaryGenre when Gemini didn't supply one or it didn't resolve. */
  primaryGenre: string;
  subGenres: string[];
  styleTags: string[];
  regionTags: string[];
  eraTags: string[];
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    results: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          // Legacy flat list — still requested so backward-compat
          // readers keep getting the same data shape.
          genres: { type: "ARRAY", items: { type: "STRING" } },
          moods: { type: "ARRAY", items: { type: "STRING" } },
          energy: { type: "NUMBER" },
          tempo: { type: "NUMBER" },
          acousticness: { type: "NUMBER" },
          instruments: { type: "ARRAY", items: { type: "STRING" } },
          realArtist: { type: "STRING" },
          realTitle: { type: "STRING" },
          // ── Multi-label (May 2026) ──
          primaryGenre: { type: "STRING" },
          subGenres: { type: "ARRAY", items: { type: "STRING" } },
          styleTags: { type: "ARRAY", items: { type: "STRING" } },
          regionTags: { type: "ARRAY", items: { type: "STRING" } },
          eraTags: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "id", "genres", "moods", "energy", "tempo", "acousticness",
          "instruments", "realArtist", "realTitle",
          "primaryGenre", "subGenres", "styleTags", "regionTags", "eraTags",
        ],
      },
    },
  },
  required: ["results"],
};

const clamp01 = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
};

function toObj(arr: unknown, maxLen: number): Record<string, number> {
  const o: Record<string, number> = {};
  if (Array.isArray(arr)) {
    for (const x of arr) {
      const k = String(x ?? "").toLowerCase().trim();
      if (k && k.length <= maxLen) o[k] = 1;
    }
  }
  return o;
}

/** Normalise a Gemini-supplied genre string to a canonical genreDict id.
 *  Returns null if the string doesn't resolve — caller drops it instead
 *  of polluting the DB with an unrecognised label. */
function canonGenreId(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  return findGenre(s)?.id ?? null;
}

/** Free-form tag normaliser — lowercase, trim, drop empties, cap length.
 *  Used for styleTags / regionTags / eraTags where we don't dictionary-
 *  canonicalise (the vocabulary is open). */
function toTags(arr: unknown, maxLen: number, maxItems: number): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const v = String(x ?? "").toLowerCase().trim();
    if (!v || v.length > maxLen || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Analyzes several tracks in one Gemini call. Throws if the call fails so the
 * caller can retry the batch. Whitelisted users pass bypassCap to skip the
 * daily Gemini ceiling.
 */
export async function aiAnalyzeBatch(
  tracks: AiAnalysisInput[],
  bypassCap = false,
  userId?: string,
): Promise<AiAnalysisRow[]> {
  if (tracks.length === 0) return [];

  const list = tracks.map((t) => `[${t.id}] ${t.artist} — ${t.title}`).join("\n");
  // Prompt updated May 2026 to request multi-label output. The genreDict
  // family taxonomy is summarised so Gemini knows the canonical vocabulary
  // we expect ("indie pop" / "drill" / "neo soul" / "city pop" / "k-pop"
  // — the same strings genreDict.aliases lists). Any returned string we
  // can't resolve via findGenre() gets dropped client-side.
  const prompt = `다음 곡들을 분석해라. 각 곡마다 아래 필드를 JSON 으로:

[기본 — 기존 호환]
- genres (배열): 이 곡의 구체적 하위 장르 2~5개. 영문 소문자. 예) ["indie pop", "dream pop"]
- moods (배열): 정서 1~3개. 영문 소문자. 예) ["nostalgic", "dreamy"]
- energy (0~1): 0=차분 → 1=격렬
- tempo (0~1): 0=느림 → 1=빠름
- acousticness (0~1): 0=전자음 → 1=어쿠스틱
- instruments (배열, 2~4): 두드러진 악기/음색. 영문 소문자.
- realArtist / realTitle: artist 가 YouTube 채널·커버·플리·믹스 계정이면 title 에서 실제 아티스트/제목 추출. 일반 아티스트면 둘 다 "".

[멀티 라벨 — 신규]
- primaryGenre: 이 곡의 대표 하위 장르 1개 (genres 의 한 항목 또는 더 정확한 표현).
- subGenres (배열): 추가 하위 장르들. 1곡에 4-5개까지 가능. 예) NewJeans → ["k-pop", "dance pop", "r&b", "uk garage", "jersey club"]
- styleTags (배열, 0~5): 장르가 아닌 스타일 묘사. 예) ["guitar-driven", "melodic", "nostalgic", "anthemic", "hook-driven", "reverb-heavy", "808-bass", "tape-saturated"]
- regionTags (배열, 0~3): 지역·신 라벨. 예) ["korean", "japanese", "british", "latin", "afro", "nordic"]
- eraTags (배열, 0~3): 시대 라벨. 예) ["2020s", "2010s", "2000s", "90s", "80s", "70s", "modern", "retro"]

장르 어휘 (대표 카테고리):
Pop / Rock / Metal / Punk / Hip-Hop / R&B Soul Funk / Electronic / Jazz / Classical / Folk / Country / Blues / Latin / Reggae / African / Asian Pop (K-pop·J-pop 등) / World / Ambient Experimental / Religious / Spoken / Children's

규칙:
- 정말 모르는 곡은 모든 배열을 [], primaryGenre 를 "", 수치는 0.5 근처.
- id 는 입력 대괄호 안 값을 그대로 사용.
- 한 트랙은 여러 장르를 동시에 가질 수 있다 (multi-label OK).

${list}`;

  // Per-track workhorse — flash-lite is materially cheaper than flash (~25%)
  // and the output is structured JSON, so the quality gap doesn't show.
  // Override via GEMINI_MODEL_ANALYZE if needed.
  // Bumped 2.0 → 2.5 in R25b after Google deprecated the 2.0 line for
  // new API keys (returns 404 NOT_FOUND on freshly-issued keys).
  const model = process.env.GEMINI_MODEL_ANALYZE ?? "gemini-2.5-flash-lite";
  let raw: unknown;
  try {
    raw = await aiJson<unknown>(prompt, SCHEMA, { bypassCap, model, userId });
  } catch (e) {
    // Cap errors must propagate so the job parks; everything else collapses
    // to defaults so the batch isn't retried forever on the same tracks.
    if (String(e).includes("GEMINI_DAILY_CAP")) throw e;
    return tracks.map((t) => emptyResult(t.id));
  }
  const validated = AnalyzeBatchZ.safeParse(raw);
  if (!validated.success) {
    // Earlier this threw — and the throw was the source of the "stuck at
    // 98%" stalls: batchOrCap caught the throw, the tick returned ok, and
    // the next tick picked the same N tracks (still audio_feel IS NULL)
    // and reproduced the same Gemini failure. Forever. Now we return
    // default rows so save_ai_analysis stamps audio_feel and the tracks
    // exit the queue. Genres stay empty (NOT `{"unknown": 1}`) because
    // save_ai_analysis merges genres via JSONB `||`, and a sentinel
    // weight would dominate any real Last.fm tags written in Phase 1.
    return tracks.map((t) => emptyResult(t.id));
  }
  const byId = new Map<string, z.infer<typeof AnalyzeRowZ>>();
  for (const r of validated.data.results) byId.set(r.id, r);

  return tracks.map((t) => {
    const r = byId.get(t.id);
    // ── Multi-label normalisation ──
    // primaryGenre: try the explicit field first, then fall back to the
    // first entry of subGenres / genres so the column is populated even
    // when Gemini forgets the new field. Always canonicalised to a
    // genreDict id (or empty string when nothing resolves).
    const primaryRaw = r?.primaryGenre ?? "";
    const primaryId =
      canonGenreId(primaryRaw) ??
      (Array.isArray(r?.subGenres)
        ? canonGenreId(r.subGenres[0])
        : null) ??
      (Array.isArray(r?.genres) ? canonGenreId(r.genres[0]) : null) ??
      "";
    // subGenres: canonicalised + de-duped, primary excluded.
    const subSet = new Set<string>();
    if (Array.isArray(r?.subGenres)) {
      for (const x of r.subGenres) {
        const id = canonGenreId(x);
        if (id && id !== primaryId) subSet.add(id);
      }
    }
    // If Gemini omitted subGenres but populated the legacy genres array,
    // backfill from there so the new column still gets signal on early
    // calls before the model fully adopts the schema.
    if (subSet.size === 0 && Array.isArray(r?.genres)) {
      for (const x of r.genres) {
        const id = canonGenreId(x);
        if (id && id !== primaryId) subSet.add(id);
      }
    }
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
              .map((x: unknown) => String(x ?? "").toLowerCase().trim())
              .filter((x: string) => x && x.length <= 24)
              .slice(0, 4)
          : [],
      },
      realArtist: typeof r?.realArtist === "string" ? r.realArtist.trim() : "",
      realTitle: typeof r?.realTitle === "string" ? r.realTitle.trim() : "",
      primaryGenre: primaryId,
      subGenres: [...subSet].slice(0, 6),
      // Free-form vocab — 24-char cap, max 5 entries each.
      styleTags: toTags(r?.styleTags, 24, 5),
      regionTags: toTags(r?.regionTags, 16, 3),
      eraTags: toTags(r?.eraTags, 12, 3),
    };
  });
}

/** Default-filled row used when Gemini returns an unparseable response.
 *  Stamps audio_feel so the track exits the analysis queue instead of
 *  being retried on every cron tick forever. */
function emptyResult(trackId: string): AiAnalysisRow {
  return {
    trackId,
    genres: {},
    moods: {},
    audioFeel: { energy: 0.5, tempo: 0.5, acousticness: 0.5, instruments: [] },
    realArtist: "",
    realTitle: "",
    primaryGenre: "",
    subGenres: [],
    styleTags: [],
    regionTags: [],
    eraTags: [],
  };
}
