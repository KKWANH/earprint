import type { MetadataRoute } from "next";

/**
 * Sitemap for the publicly-indexable surface of Earprint.
 *
 * Authenticated routes (/library, /profile, /dna, /map, /recommend,
 * /worldcup, /connect, /account) are deliberately excluded — they show
 * per-user data and Google indexing them would either fail (302 to
 * sign-in) or, in the worst case, surface a real user's snapshot.
 *
 * Share pages (/s/<id>) are also excluded: they're public per the
 * user's own action, but we don't want them aggregated into a public
 * "browse other people's taste" surface. If a user wants their share
 * page indexed they paste the URL where it belongs.
 */
const ORIGIN = "https://earprint.kwanho.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${ORIGIN}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${ORIGIN}/demo`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${ORIGIN}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${ORIGIN}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ORIGIN}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${ORIGIN}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${ORIGIN}/security`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${ORIGIN}/genres`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
  ];
}
