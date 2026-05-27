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
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
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
          "/worldcup",
          "/s/",
          "/onboarding",
          "/genre/",
          "/artist/",
        ],
      },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
    host: ORIGIN,
  };
}
