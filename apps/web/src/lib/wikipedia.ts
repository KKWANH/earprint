import { getSql } from "./db";

/**
 * Wikipedia REST API lookup with DB cache. We hit the page-summary
 * endpoint which returns a short extract + canonical URL — no API
 * key needed, generous rate limits (~200 req/s), permissive CORS.
 *
 * Cache duration: 30 days. Wikipedia entries change rarely; even a
 * stale extract is more useful than a refetch on every page render.
 * The fetched_at column drives the freshness check.
 *
 * Strategy:
 *   1. Check genre_info row for cached extract + url.
 *   2. If absent OR > 30 days old: hit Wikipedia, write back.
 *   3. Return whatever we have (cached or fresh).
 *
 * Per-language: we ask en.wikipedia.org for English + ko.wikipedia
 * for Korean independently. Either may return 404 (no matching
 * article); cached as empty string in that case so we don't retry
 * within the freshness window.
 */
export interface WikiSummary {
  extractEn: string | null;
  extractKo: string | null;
  urlEn: string | null;
  urlKo: string | null;
}

const REST = (lang: "en" | "ko") =>
  `https://${lang}.wikipedia.org/api/rest_v1/page/summary`;

const FRESH_DAYS = 30;

interface RestResp {
  type?: string;
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function fetchOne(
  lang: "en" | "ko",
  query: string,
): Promise<{ extract: string; url: string } | null> {
  try {
    const url = `${REST(lang)}/${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      // Wikipedia asks for a UA — gracefully identify ourselves so
      // they can throttle bad actors without nuking everyone.
      headers: {
        "User-Agent": "Earprint/1.0 (https://earprint.kwanho.dev)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RestResp;
    // type === 'disambiguation' returns multiple options — treat as
    // a miss rather than dump an unhelpful "may refer to" blurb.
    if (data.type === "disambiguation") return null;
    if (!data.extract || !data.content_urls?.desktop?.page) return null;
    return {
      extract: data.extract,
      url: data.content_urls.desktop.page,
    };
  } catch {
    return null;
  }
}

export async function loadWikiSummary(genre: string): Promise<WikiSummary> {
  const sql = getSql();
  const key = genre.toLowerCase().trim();

  // Pull whatever's cached. The row may not exist at all (long-tail
  // genre) — that's fine, we'll write to a fresh row at the end.
  let cached: Partial<WikiSummary> = {
    extractEn: null,
    extractKo: null,
    urlEn: null,
    urlKo: null,
  };
  let fetchedAt: Date | null = null;
  try {
    const rows = await sql`
      SELECT wiki_extract_en, wiki_extract_ko,
             wiki_url_en, wiki_url_ko, wiki_fetched_at
      FROM genre_info WHERE genre = ${key}`;
    if (rows.length > 0) {
      const r = rows[0]!;
      cached = {
        extractEn: (r.wiki_extract_en as string | null) ?? null,
        extractKo: (r.wiki_extract_ko as string | null) ?? null,
        urlEn: (r.wiki_url_en as string | null) ?? null,
        urlKo: (r.wiki_url_ko as string | null) ?? null,
      };
      fetchedAt = r.wiki_fetched_at
        ? new Date(r.wiki_fetched_at as string)
        : null;
    }
  } catch {
    /* genre_info missing wiki_* columns — fall through to live fetch */
  }

  // Fresh enough? Return cache. Empty-string cached values are
  // treated as misses we previously confirmed — don't re-query.
  const isFresh =
    fetchedAt && Date.now() - fetchedAt.getTime() < FRESH_DAYS * 86400 * 1000;
  if (isFresh) {
    return {
      extractEn: cached.extractEn ?? null,
      extractKo: cached.extractKo ?? null,
      urlEn: cached.urlEn ?? null,
      urlKo: cached.urlKo ?? null,
    };
  }

  // Cold / stale — fetch both langs in parallel. Each can independently
  // 404; we cache the miss as empty string ('') so the freshness window
  // suppresses repeat lookups for the same gap.
  const [en, ko] = await Promise.all([
    fetchOne("en", genre),
    fetchOne("ko", genre),
  ]);
  const out: WikiSummary = {
    extractEn: en?.extract ?? "",
    extractKo: ko?.extract ?? "",
    urlEn: en?.url ?? "",
    urlKo: ko?.url ?? "",
  };

  // Write back. Ensures the row exists (lazy-warm path may not have
  // touched it yet), then updates only the wiki_* columns.
  try {
    await sql`
      INSERT INTO genre_info (genre, description_en, description_ko)
      VALUES (${key}, NULL, NULL)
      ON CONFLICT (genre) DO NOTHING`;
    await sql`
      UPDATE genre_info
      SET wiki_extract_en = ${out.extractEn},
          wiki_extract_ko = ${out.extractKo},
          wiki_url_en     = ${out.urlEn},
          wiki_url_ko     = ${out.urlKo},
          wiki_fetched_at = now()
      WHERE genre = ${key}`;
  } catch {
    /* cache write best-effort; we still return the live fetch */
  }

  // Normalise empty strings (cache misses) back to null for the caller.
  return {
    extractEn: out.extractEn || null,
    extractKo: out.extractKo || null,
    urlEn: out.urlEn || null,
    urlKo: out.urlKo || null,
  };
}
