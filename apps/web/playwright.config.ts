import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config (R39). Smoke-tests that public pages render without
 * runtime crashes — the class of bug unit tests + tsc don't catch
 * (RSC serialization breaks, null-deref in render, a client component
 * that throws on mount). Auth-gated flows (login → sync → analyze →
 * worldcup → share) need a seeded test DB + a test auth path; see
 * e2e/README.md for the Phase-2 plan.
 *
 * Run: `pnpm e2e`. Boots `next dev` automatically unless E2E_BASE_URL
 * points at an already-running server (e.g. a preview deploy).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Load .dev.vars (DATABASE_URL, AUTH_SECRET, …) the same way the
        // local node scripts do — plain `next dev` doesn't read it, so
        // DB-backed pages would 500. --env-file parses dotenv properly
        // (handles quoted values), unlike sourcing in a shell.
        command: "node --env-file=.dev.vars node_modules/next/dist/bin/next dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
