import { test, expect } from "@playwright/test";

/**
 * Public-page smoke tests (R39). No auth, no seeded DB — these assert
 * the pages a logged-out visitor hits render without crashing. DB-backed
 * pages (/genres) are wrapped in try/catch server-side, so they show an
 * empty state instead of a 500 when the test env has no data — which is
 * exactly what we want to confirm here.
 */

test("landing shows the value prop + no-signup trust line", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Earprint", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/no sign-up|가입 없이/)).toBeVisible();
});

test("demo page offers the interactive worldcup", async ({ page }) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("button", { name: /^(Start|시작)$/ }),
  ).toBeVisible();
});

test("starting the demo worldcup enters the bracket", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /^(Start|시작)$/ }).click();
  await expect(page.getByText(/Sample worldcup|샘플 월드컵/)).toBeVisible();
});

// NOTE: /compare is auth-gated (requireOnboarded redirects logged-out
// visitors), so it can't be smoke-tested without a session — it belongs
// in the Phase-2 authed suite (see e2e/README.md).

test("unknown creator handle returns 404", async ({ page }) => {
  const res = await page.goto("/u/no-such-user-xyz-123");
  expect(res?.status()).toBe(404);
});

// NOTE: /genres is auth-gated too (requireOnboarded) — logged-out
// visitors get the sign-in CTA, not the genre list. Phase 2.

test("community recent-results feed renders (public, DB-backed)", async ({
  page,
}) => {
  await page.goto("/worldcup/community/recent");
  await expect(page.getByText(/Recent results|최근 결과/)).toBeVisible();
});
