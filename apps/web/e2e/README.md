# E2E tests (Playwright)

Smoke-tests for public pages — no auth, no DB seeding required. They
catch the class of bug that `tsc` + vitest miss: pages that compile but
crash at render (RSC serialization, null-deref, a client component that
throws on mount). This is the kind of regression that shipped twice
during R39 before the build caught it.

## Run

```bash
pnpm e2e            # boots `next dev` automatically, runs chromium
pnpm e2e --ui       # interactive
```

Needs `apps/web/.dev.vars` for env (the dev server reads it). To run
against an already-running server (e.g. a preview deploy) instead of
booting one, set `E2E_BASE_URL`:

```bash
E2E_BASE_URL=https://earprint.kwanho.dev pnpm e2e
```

First run only: install the browser binary with
`pnpm exec playwright install chromium`.

## Phase 2 — auth + seeded DB (TODO)

The high-value flows (login → sync → analyze → worldcup → share) need:

1. **A throwaway Neon branch** seeded with a test user + `user_tracks`
   + `analysis` rows. Create one off `main` (`neonctl branches create`
   or the dashboard) so tests never touch production data, and point
   the run at it via a test `DATABASE_URL`.
2. **A test auth path** — the app uses NextAuth + Google, which can't
   run headless. Options: a credentials provider enabled only when
   `E2E=1`, or a global-setup step that mints a NextAuth session cookie
   and injects it via `storageState`.

Keep these in a separate `e2e/authed/` project with its own
`storageState` so the public smoke tests stay zero-setup.
