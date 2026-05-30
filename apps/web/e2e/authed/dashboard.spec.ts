import { test, expect } from "@playwright/test";

/**
 * Authed smoke suite (R40b). Runs with the storageState minted in
 * auth.setup.ts against the seeded test user, so these exercise the
 * logged-in surfaces the public suite can't reach. They assert the
 * pages render for a real session instead of bouncing to sign-in /
 * /onboarding / /connect — the regression class that matters once a
 * user is past the auth wall.
 *
 * Run: `DATABASE_URL=<test-branch> pnpm e2e:authed` (see e2e/README.md).
 */

test("library dashboard renders for the authed user", async ({ page }) => {
  await page.goto("/library");
  // Stayed on /library (not redirected to sign-in / onboarding / connect).
  await expect(page).toHaveURL(/\/library/);
  await expect(page.getByRole("heading").first()).toBeVisible();
  // The seed gives the user a library, so the quick-actions hub shows.
  await expect(page.getByText(/Psychology|심리분석/)).toBeVisible();
});

test("worldcup hub loads for the authed user", async ({ page }) => {
  await page.goto("/worldcup");
  await expect(page).toHaveURL(/\/worldcup/);
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("psychology profile renders for the authed user", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile/);
});
