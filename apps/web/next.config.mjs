/** @type {import('next').NextConfig} */

/**
 * Security headers applied to every response.
 *
 * Layout choices:
 * - CSP is intentionally permissive on script-src/style-src ('unsafe-inline')
 *   because Next.js App Router emits inline RSC bootstrap scripts and
 *   Tailwind injects inline style elements. Tightening this to a nonce-based
 *   policy requires wiring middleware to inject the nonce into every <Script>
 *   — left for a follow-up.
 * - img-src allows `https:` broadly because we render album art from Deezer,
 *   MusicBrainz, YouTube CDNs, and several other third-party music providers
 *   whose specific subdomains shift over time.
 * - frame-src allows youtube-nocookie + youtube for the Worldcup video embeds.
 * - frame-ancestors 'none' blocks our app from being iframed (clickjacking
 *   defense). X-Frame-Options DENY repeats this for older user-agents.
 * - HSTS uses a 2-year max-age + preload — Cloudflare also sets HSTS at the
 *   edge for kwanho.dev; this header makes the intent explicit at app level.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig = {
  // Transpile the monorepo-internal package (TS source) in Next's build pipeline.
  transpilePackages: ["@playlist-analyzer/shared"],

  async headers() {
    return [
      // Apply to every route. /api/sync sets its own Access-Control-* headers
      // for the extension, which are additive (not in this list).
      { source: "/:path*", headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
