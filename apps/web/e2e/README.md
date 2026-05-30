# E2E tests (Playwright)

Two suites, selected by the `E2E_AUTHED` env var.

## Public smoke suite — `pnpm e2e`

Logged-out pages, no DB seeding. Catches render-time crashes that
`tsc` + vitest miss (RSC serialization, null-deref, a client component
that throws on mount). Boots `next dev` with `--env-file=.dev.vars` so
DB-backed public pages render.

```bash
pnpm e2e            # chromium, public pages
pnpm e2e --ui       # interactive
```

Covers: landing, demo page, the demo worldcup bracket, `/u` 404, and
the community recent-results feed. First run only: install the browser
with `pnpm exec playwright install chromium`.

## Authed suite — `pnpm e2e:authed`  (needs a test DB)

Logged-in surfaces (`/library`, `/worldcup`, `/profile`). No
`src/auth.ts` changes: `e2e/auth.setup.ts` mints a NextAuth v5 session
cookie with the shared `AUTH_SECRET` (via `@auth/core/jwt` `encode`, the
same path the server decodes), writes it as `storageState`, and the
authed project reuses it.

**Use a throwaway Neon branch — never production.** A bare
`pnpm e2e:authed` fails safe (the config refuses to pull `DATABASE_URL`
from `.dev.vars` in authed mode), so you must pass a test-branch URL:

```bash
# 1. Create a branch off main (Neon dashboard or CLI):
neonctl branches create --name e2e --parent main
TEST_DB="postgresql://…@…-e2e…/neondb"

# 2. Seed the test user + a small analyzed library into the branch:
DATABASE_URL="$TEST_DB" pnpm e2e:seed      # → "E2E_SEED_OK <userId>"

# 3. Run the authed suite against the branch:
DATABASE_URL="$TEST_DB" pnpm e2e:authed
```

The seed (`scripts/e2e-seed.mjs`) is idempotent and scoped to
`e2e-test@earprint.dev` + fixed test-track UUIDs, so re-running is a
no-op and it never mutates real rows.

`e2e/.auth/` (the minted cookie) is gitignored.

## Notes
- CI: set `E2E_BASE_URL` to a deployed preview to skip booting a server,
  and provide the test `DATABASE_URL` + `AUTH_SECRET` as CI secrets.
- Adding more authed coverage (worldcup create → finish → share, compare
  on `/u/[handle]`) is just more specs in `e2e/authed/` — the seed
  already publishes enough data; extend it if a flow needs more.
