import type { MetadataRoute } from "next";

/**
 * Robots policy for the public crawl. Allow the marketing surface,
 * block every per-user route. The disallow list mirrors the routes
 * intentionally excluded from sitemap.ts.
 *
 * /api/* is blocked because crawlers hitting auth-gated endpoints just
 * waste budget; they don't serve discoverable content.
 *
 * /admin and /account are blocked to keep operator + user-settings
 * URLs out of search results (defence-in-depth — they're already
 * auth-gated, but no point letting Google try).
 */
const ORIGIN = "https://earprint.kwanho.dev";

export default function robots(): MetadataRoute.Robots {
  // R32g — synchronised with sitemap.ts. The sitemap NOW surfaces
  // /genre/<name>, /worldcup/community/*, /worldcup/community/tag/*,
  // and /u/<handle> as canonical content; blocking those in robots
  // gave Google contradictory signals (sitemap inclusion + robots
  // disallow). Per-user routes (/library, /profile, /map, /recommend,
  // /worldcup itself, /worldcup/[cat]/[size], /worldcup/curate/*,
  // /worldcup/champion/*) stay blocked because they're auth-gated
  // dashboards that would 302 → sign-in if crawled anyway.
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          // Public canonical pages (in sitemap):
          "/genre/",
          "/genres",
          "/u/",
          "/worldcup/community",
          "/worldcup/community/",
        ],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/account",
          "/account/",
          "/connect",
          "/library",
          "/profile",
          "/dna",
          "/map",
          "/recommend",
          // The auth-gated dashboard at /worldcup itself stays
          // blocked, but more-specific allow rules above let the
          // community paths through.
          "/worldcup$",
          "/worldcup/[cat]/",
          "/worldcup/curate/",
          "/worldcup/champion/",
          "/worldcup/genre/",
          "/s/",
          "/onboarding",
          "/artist/",
        ],
      },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
    host: ORIGIN,
  };
}
