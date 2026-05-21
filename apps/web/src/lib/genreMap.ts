import { getSql } from "./db";
import { getExcludedArtists } from "./library";

/** A genre node for the interactive taste constellation. */
export interface GenreNode {
  name: string;
  count: number; // liked tracks carrying this genre
}

/** Two genres that co-occur on the same tracks. */
export interface GenreEdge {
  a: number;
  b: number;
  weight: number; // number of tracks where both appear
}

export interface GenreMapData {
  nodes: GenreNode[];
  edges: GenreEdge[];
}

const MAX_GENRES = 32;

/**
 * Builds the genre constellation — genres sized by how often they appear in
 * the library, linked when they co-occur on the same track. Co-occurrence is
 * what makes the layout meaningful: genres the user blends sit together.
 */
export async function getGenreMap(userId: string): Promise<GenreMapData> {
  const sql = getSql();
  const excluded = await getExcludedArtists(userId);

  const rows = await sql`
    SELECT array_agg(k.key) AS genres
    FROM analysis a
    JOIN user_tracks ut ON ut.track_id = a.track_id
    JOIN tracks t ON t.id = a.track_id
    CROSS JOIN LATERAL jsonb_object_keys(a.genres) AS k(key)
    WHERE ut.user_id = ${userId} AND a.genres IS NOT NULL
      AND t.artist <> ALL(${excluded}::text[])
    GROUP BY a.track_id`;

  const freq = new Map<string, number>();
  const perTrack: string[][] = [];
  for (const r of rows) {
    const gs = [
      ...new Set(
        (r.genres as string[]).map((g) => g.toLowerCase().trim()).filter(Boolean),
      ),
    ];
    perTrack.push(gs);
    for (const g of gs) freq.set(g, (freq.get(g) ?? 0) + 1);
  }

  const nodes: GenreNode[] = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GENRES)
    .map(([name, count]) => ({ name, count }));
  const idx = new Map(nodes.map((n, i) => [n.name, i]));

  const pairs = new Map<string, number>();
  for (const gs of perTrack) {
    const top = gs.filter((g) => idx.has(g));
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const a = idx.get(top[i]!)!;
        const b = idx.get(top[j]!)!;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }

  const edges: GenreEdge[] = [...pairs.entries()]
    .map(([key, weight]) => {
      const parts = key.split("-");
      return { a: Number(parts[0]), b: Number(parts[1]), weight };
    })
    .filter((e) => e.weight >= 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 140);

  return { nodes, edges };
}
