import { test as setup } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import fs from "node:fs";
import path from "node:path";

/**
 * Authed-E2E global setup (R40b). Mints a NextAuth v5 session cookie
 * for the seeded test user and writes it as Playwright storageState —
 * WITHOUT touching src/auth.ts (zero production-auth risk).
 *
 * How it works: NextAuth v5 stores the session as an encrypted JWT
 * (JWE) in the `authjs.session-token` cookie (non-secure name on http
 * localhost). We call the SAME `encode` from @auth/core/jwt that the
 * server uses, with salt = cookie name + the shared AUTH_SECRET, so the
 * dev server's `decode` accepts it. auth() then resolves the session;
 * ensureConnection() maps email → the seeded users row.
 *
 * Requires AUTH_SECRET in the environment (playwright.config.ts loads
 * .dev.vars) and the test user already seeded (scripts/e2e-seed.mjs).
 */
const TEST_EMAIL = "e2e-test@earprint.dev";
const COOKIE_NAME = "authjs.session-token"; // http localhost → non-secure
const AUTH_FILE = "e2e/.auth/user.json";

setup("authenticate the seeded test user", async () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET missing — run via `pnpm e2e:authed` so .dev.vars is loaded.",
    );
  }

  const token = await encode({
    token: { name: "E2E Test", email: TEST_EMAIL, sub: "e2e-test" },
    secret,
    salt: COOKIE_NAME,
    maxAge: 60 * 60, // 1 hour — plenty for one test run
  });

  const storageState = {
    cookies: [
      {
        name: COOKIE_NAME,
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
        expires: Math.floor(Date.now() / 1000) + 3600,
      },
    ],
    origins: [],
  };

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
});
