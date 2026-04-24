// Phase 22.1 — End-to-end: footer version link opens release history and
// content loads.
//
// Flow validated:
//   1. Open a page that renders the app shell footer (login page, which is a
//      public page so it does not depend on the check-users redirect).
//   2. Click the footer Version link.
//   3. Confirm the browser lands on /pages/release-history.html.
//   4. Confirm the release-history content element is populated via the
//      /api/release-history endpoint — i.e. no longer the "Loading..."
//      placeholder, not the failure fallback, and containing the known
//      seed string from data/release_history.txt.
//
// The test tolerates main.js's "redirect to register when no users exist"
// behavior on the release-history page by ensuring at least one user exists
// before acting on the footer link. It uses the public
// POST /api/auth/register endpoint idempotently (409 USER_EXISTS is fine).

const { test, expect, request } = require('@playwright/test');

async function ensureAtLeastOneUser(apiRequestContext, baseURL) {
  const check = await apiRequestContext.get(`${baseURL}/api/auth/check-users`);
  if (!check.ok()) {
    throw new Error(`check-users failed: HTTP ${check.status()}`);
  }
  const { hasUsers } = await check.json();
  if (hasUsers) {
    return;
  }
  // Register the first user (will become admin automatically). Any 2xx or
  // 409 USER_EXISTS both satisfy the precondition.
  const register = await apiRequestContext.post(`${baseURL}/api/auth/register`, {
    data: {
      email: 'e2e-release-history-seed@test.com',
      password: 'Password123!',
      first_name: 'E2E',
      last_name: 'Seed',
      office_location: 'London',
    },
  });
  if (!register.ok() && register.status() !== 409) {
    const body = await register.text();
    throw new Error(`register seed user failed: HTTP ${register.status()} ${body}`);
  }
}

test.describe('Release history footer link (Phase 22.1)', () => {
  test.beforeAll(async ({ playwright }) => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const ctx = await request.newContext();
    try {
      await ensureAtLeastOneUser(ctx, baseURL);
    } finally {
      await ctx.dispose();
    }
  });

  test('footer Version link opens release history and loads file content', async ({ page }) => {
    // Login page is public (exempt from the check-users redirect in main.js)
    // and renders the same footer with id="version-link".
    await page.goto('/pages/login.html');

    const versionLink = page.locator('#version-link');
    await expect(versionLink).toBeVisible();
    await expect(versionLink).toHaveAttribute('href', '/pages/release-history.html');

    await Promise.all([
      page.waitForURL(/\/pages\/release-history\.html$/),
      versionLink.click(),
    ]);

    // The page script fetches /api/release-history and replaces the
    // "Loading..." placeholder with the file contents.
    const content = page.locator('#release-history-content');
    await expect(content).toBeVisible();
    await expect(content).not.toHaveText('Loading...');
    await expect(content).not.toHaveText(
      'Could not load release history. Please try again later.'
    );

    const text = (await content.textContent()) || '';
    expect(text.trim().length).toBeGreaterThan(0);
    // Seeded release history includes a well-known line from
    // data/release_history.txt. If the file is edited, update this assertion.
    expect(text).toContain('Release history');
  });
});
