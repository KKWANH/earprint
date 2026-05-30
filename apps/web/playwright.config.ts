import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

/**
 * E2E config (R39 public smoke + R40b authed suite).
 *
 * Two modes, selected by E2E_AUTHED:
 *  - default (`pnpm e2e`): PUBLIC smoke suite (e2e/smoke.spec.ts). No
 *    auth, no seeding. Boots `next dev` with --env-file=.dev.vars so
 *    DB-backed public pages render.
 *  - authed (`pnpm e2e:authed`): logged-in suite (e2e/authed/*). A
 *    setup project mints a session cookie (auth.setup.ts) for the
 *    seeded test user; the dev server runs against a DATABASE_URL the
 *    caller supplies (a throwaway Neon branch — NEVER production).
 *
 * .dev.vars is parsed into process.env here so the setup project can
 * read AUTH_SECRET. In authed mode we deliberately DO NOT pull
 * DATABASE_URL from .dev.vars — the caller must pass a test-branch URL,
 * so a bare `pnpm e2e:authed` fails safe instead of seeding production.
 */
const authed = !!process.env.E2E_AUTHED;

try {
  for (const line of fs.readFileSync(".dev.vars", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue; // caller-provided env wins
    if (authed && key === "DATABASE_URL") continue; // force explicit test DB
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[key] = v;
  }
} catch {
  /* no .dev.vars (e.g. CI) — rely on the ambient env */
}

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
  projects: authed
    ? [
        { name: "setup", testMatch: /auth\.setup\.ts/ },
        {
          name: "authed",
          testMatch: /authed\/.*\.spec\.ts/,
          dependencies: ["setup"],
          use: {
            ...devices["Desktop Chrome"],
            storageState: "e2e/.auth/user.json",
          },
        },
      ]
    : [
        {
          name: "chromium",
          testMatch: /smoke\.spec\.ts/,
          use: { ...devices["Desktop Chrome"] },
        },
      ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Plain `next dev` for both modes. The dev server inherits this
        // process's env, and the .dev.vars values were already loaded
        // into process.env at the top of this config (when the file
        // exists). So we don't pass --env-file — that would hard-fail
        // in CI where .dev.vars is absent. Local dev: vars come from the
        // loader above; CI: from the workflow env / secrets.
        command: "node node_modules/next/dist/bin/next dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: process.env as Record<string, string>,
      },
});
