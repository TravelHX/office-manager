// Phase 29.8 — End-to-end: the admin Save Configuration spinner appears,
// the button becomes disabled while the request is in flight, and both the
// spinner and the disabled state clear on success. Repeated for an
// unchanged-parking flow so we exercise the second arm of the same handler.
//
// The test seeds an admin user via the public registration endpoint (the
// first registration is granted admin automatically), then drives the
// browser through the Resource Configuration save flow.
//
// We deliberately observe the spinner via Playwright's poll-based state
// assertions rather than asserting on the in-flight DOM mid-request, which
// would race the network round-trip.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-save-config-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';

async function ensureAdminUser(apiRequestContext, baseURL) {
  const check = await apiRequestContext.get(`${baseURL}/api/auth/check-users`);
  if (!check.ok()) {
    throw new Error(`check-users failed: HTTP ${check.status()}`);
  }
  const { hasUsers } = await check.json();
  if (hasUsers) {
    return;
  }
  const register = await apiRequestContext.post(`${baseURL}/api/auth/register`, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      first_name: 'E2E',
      last_name: 'SaveConfig',
      office_location: 'London',
    },
  });
  if (!register.ok() && register.status() !== 409) {
    const body = await register.text();
    throw new Error(`seed admin failed: HTTP ${register.status()} ${body}`);
  }
}

async function loginAsFirstAdmin(page, baseURL) {
  // The public registration endpoint grants admin only to the first user.
  // If a different admin already exists (from a prior test seed), we still
  // exercise the spinner by signing in as them — but we cannot guarantee
  // the password without a fresh DB. The pragmatic approach is: try the
  // seeded credentials first; on failure, skip the rest of the flow.
  await page.goto('/pages/login.html');
  await page.fill('#username', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('#loginBtn');
  // Successful login redirects to "/" (home).
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '');
}

test.describe('Phase 29.8: admin Save Configuration spinner', () => {
  test.beforeAll(async () => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const ctx = await request.newContext();
    try {
      await ensureAdminUser(ctx, baseURL);
    } finally {
      await ctx.dispose();
    }
  });

  test('Save Configuration shows a spinner and re-enables the button on success', async ({ page }) => {
    test.skip(!process.env.E2E_RUN_AUTHENTICATED, 'requires a clean DB seeded with the test admin (set E2E_RUN_AUTHENTICATED=1 to enable)');

    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    await loginAsFirstAdmin(page, baseURL);

    await page.goto('/pages/admin.html');
    const button = page.locator('#saveConfigurationBtn');
    await expect(button).toBeVisible();

    // Read the current value so we set it back to itself; that round-trips
    // through the same API path without changing observable state.
    const deskCount = await page.locator('#deskCount').inputValue();
    await page.locator('#deskCount').fill(deskCount || '0');

    // Trigger save and assert the in-flight visual state, then the cleared
    // post-success state. Playwright auto-retries the assertions so we
    // tolerate fast or slow network round-trips.
    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button.locator('.btn-spinner')).toBeVisible();
    await expect(button).toBeDisabled();

    await expect(button).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
    await expect(button.locator('.btn-spinner')).toHaveCount(0);
    await expect(button).toBeEnabled();
  });

  test('parking-only Save Configuration: spinner appears and clears (symmetric flow)', async ({ page }) => {
    test.skip(!process.env.E2E_RUN_AUTHENTICATED, 'requires a clean DB seeded with the test admin (set E2E_RUN_AUTHENTICATED=1 to enable)');

    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    await loginAsFirstAdmin(page, baseURL);

    await page.goto('/pages/admin.html');
    const button = page.locator('#saveConfigurationBtn');
    await expect(button).toBeVisible();

    const parkingCount = await page.locator('#parkingCount').inputValue();
    await page.locator('#parkingCount').fill(parkingCount || '0');

    await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button.locator('.btn-spinner')).toBeVisible();

    await expect(button).toHaveAttribute('aria-busy', 'false', { timeout: 10_000 });
    await expect(button.locator('.btn-spinner')).toHaveCount(0);
    await expect(button).toBeEnabled();
  });
});
