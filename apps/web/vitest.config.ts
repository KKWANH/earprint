import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config (R37). Node environment — every test we have is a
 * pure-function unit test (no jsdom needed yet). The `@/` alias
 * mirrors tsconfig.json so test imports match app imports.
 *
 * Tests live next to the code under test as *.test.ts. Run with
 * `pnpm test` (added to package.json scripts).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The app pulls server-only env in some modules; tests should
    // only import pure libs, but set this so an accidental import
    // of a server module fails loudly rather than hanging.
    testTimeout: 10_000,
  },
});
