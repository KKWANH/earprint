import { getSql } from "./db";
import { genreFamily, listSubGenres } from "./genreDict";
import { GENRE_CONTENT, getGenreContent } from "../data/genre-content";

/**
 * Related-genres sidebar data for /genre/[name]. Computes three
 * orthogonal signals and merges them into a ranked list:
 *
 *   - sameFamily: other sub-genres registered under the same family
 *     id (genreDict). Cheap, deterministic, doesn't need DB.
 *
 *   - sameEra: genres whose pre-baked content has the same era label.
 *     Only works for genres covered in genre-content.ts (51 today);
 *     long-tail tags fall through with empty.
 *
 *   - coOccurring: genres that appear most often alongside this one
 *     in the analysis table — the empirical "people who tagged song X
 *     with genre A also tagged it with genre B" signal. One SQL
 *     query, capped at top-8.
 *
 * Merges by union, dedups against `genre` itself, and excludes
 * anything in isExcludedGenre to avoid surfacing noise tags.
 */

export interface RelatedGenre {
  name: string;
  /** Which signal(s) introduced this related entry; comma-separated
   *  for the title attribute on the sidebar chip. */
  reasons: ("family" | "era" | "co-occur")[];
  /** Co-occurrence weight (0 when the entry came from family/era only). */
  weight: number;
}

const MAX_OUT = 10;

export async function loadRelatedGenres(
  genre: string,
): Promise<RelatedGenre[]> {
  const sql = getSql();
  const norm = genre.toLowerCase().trim();
  const family = genreFamily(norm);
  const content = getGenreContent(norm);

  // Family bucket — pluck every sub-genre with the same family id.
  const familyMembers = new Set<string>();
  if (family) {
    for (const g of listSubGenres()) {
      if (g.family === family && g.id !== norm) familyMembers.add(g.id);
    }
  }

  // Era bucket — only available when we have curated content for this
  // genre AND others. Compare on the EN era label since it's the
  // lingua franca across the JSON entries.
  const eraMembers = new Set<string>();
  if (content?.eraEn) {
    for (const [otherKey, c] of Object.entries(GENRE_CONTENT)) {
      if (otherKey === norm) continue;
      if (c.eraEn === content.eraEn) eraMembers.add(otherKey);
    }
  }

  // Co-occurrence — analyse.genres is a JSONB {genre: weight} map per
  // track. For tracks tagged with our genre, count which other genre
  // keys appear and weight by track count.
  const coOccurring = new Map<string, number>();
  try {
    const rows = await sql`
      SELECT lower(k2.key) AS other, count(*)::int AS n
      FROM analysis a
      CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k1(key)
      CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k2(key)
      WHERE a.genres IS NOT NULL
        AND lower(k1.key) = ${norm}
        AND lower(k2.key) <> ${norm}
      GROUP BY lower(k2.key)
      ORDER BY n DESC
      LIMIT 12`;
    for (const r of rows) {
      coOccurring.set(r.other as string, Number(r.n ?? 0));
    }
  } catch {
    /* analysis table unreachable — sidebar degrades to family+era only */
  }

  // Merge.
  const merged = new Map<string, RelatedGenre>();
  const add = (
    name: string,
    reason: "family" | "era" | "co-occur",
    weight: number,
  ) => {
    if (!name || name === norm) return;
    const existing = merged.get(name);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      existing.weight += weight;
    } else {
      merged.set(name, { name, reasons: [reason], weight });
    }
  };
  for (const id of familyMembers) add(id, "family", 1);
  for (const id of eraMembers) add(id, "era", 0.6);
  for (const [id, w] of coOccurring) add(id, "co-occur", w);

  // Rank: co-occur weight dominates (empirical signal beats taxonomy),
  // ties broken by reason-count (a genre showing up via family+era+
  // co-occur is more relevant than one with just family).
  return [...merged.values()]
    .sort((a, b) => {
      const wa = a.weight + a.reasons.length * 0.1;
      const wb = b.weight + b.reasons.length * 0.1;
      return wb - wa;
    })
    .slice(0, MAX_OUT);
}
