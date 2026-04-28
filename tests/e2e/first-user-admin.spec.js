// Phase 25.3 — End-to-end: first user registers and becomes administrator.
//
// Implements the deferred Playwright task from Phase 14 and provides
// automated coverage for `docs/usecases.md` Use Case 9. The use case has
// two branches:
//
//   A. Clean stack (no users): the first POST /api/auth/register succeeds
//      and the resulting user has admin privileges.
//   B. Stack already has users: /pages/register.html hides the form and
//      shows a "self-service registration is not available" message; the
//      API responds 403 REGISTRATION_CLOSED to a register attempt.
//
// Both branches are real product behaviour. Which one runs depends on
// whether the stack started clean or already has users seeded by other
// e2e specs. We check `GET /api/auth/check-users` in beforeAll and route
// each test accordingly. This way the spec is meaningful on every run:
//   - Clean stack: branch A passes; branch B is also exercised after the
//     newly-created admin exists.
//   - Already-seeded stack: branch B passes; branch A is skipped with a
//     clear message indicating the precondition that was not met.
//
// The spec does not flush users to fabricate the clean precondition —
// doing so would invalidate the seeded state every other spec depends on.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const FIRST_USER_EMAIL = 'e2e-first-user-admin@test.com';
const FIRST_USER_PASSWORD = 'Password123!';

async function checkHasUsers(apiCtx) {
  const res = await apiCtx.get(`${BASE_URL}/api/auth/check-users`);
  if (!res.ok()) {
    throw new Error(`/api/auth/check-users returned HTTP ${res.status()}`);
  }
  const body = await res.json();
  return body.hasUsers === true;
}

test.describe('First user registers and becomes admin (Phase 25.3, Use Case 9)', () => {
  let initialHasUsers;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      initialHasUsers = await checkHasUsers(apiCtx);
    } finally {
      await apiCtx.dispose();
    }
  });

  test('first registration on a clean stack yields an admin session', async ({ page }) => {
    test.skip(
      initialHasUsers,
      'Stack already has users; clean-stack branch of Use Case 9 cannot run. ' +
        'Bring up a fresh docker-compose stack to exercise this assertion.'
    );

    await page.goto('/pages/register.html');

    // The form is visible because no users exist.
    const form = page.locator('#register-form');
    await expect(form).toBeVisible({ timeout: 10_000 });

    await page.locator('#firstName').fill('E2E');
    await page.locator('#lastName').fill('FirstAdmin');
    await page.locator('#email').fill(FIRST_USER_EMAIL);
    await page.locator('#officeLocation').selectOption({ index: 1 });
    await page.locator('#password').fill(FIRST_USER_PASSWORD);
    await page.locator('#confirmPassword').fill(FIRST_USER_PASSWORD);

    // Submit and wait for the post-registration redirect to home.
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/' || url.pathname === '/index.html', { timeout: 15_000 }),
      page.locator('#register-button').click(),
    ]);

    // Confirm the new session is admin: the stored user has isAdmin / role.
    const storedUserRaw = await page.evaluate(() => window.localStorage.getItem('user'));
    expect(storedUserRaw).toBeTruthy();
    const storedUser = JSON.parse(storedUserRaw);
    expect(storedUser.isAdmin === true || storedUser.role === 'admin').toBeTruthy();

    // And the API confirms the user truly is an admin (defensive check that
    // does not depend on what the client chose to render).
    const apiCtx = await request.newContext();
    try {
      const me = await apiCtx.get(`${BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${await page.evaluate(() => window.localStorage.getItem('authToken'))}` },
      });
      expect(me.ok()).toBeTruthy();
      const meBody = await me.json();
      expect(meBody.user && (meBody.user.isAdmin === true || meBody.user.role === 'admin')).toBeTruthy();
    } finally {
      await apiCtx.dispose();
    }
  });

  test('once any user exists, /pages/register.html shows the closed-registration message', async ({ page }) => {
    // This branch is meaningful regardless of which path the previous test
    // took — by the time this runs, a user exists either because the stack
    // was already seeded or because the first test created one.
    const apiCtx = await request.newContext();
    try {
      const hasUsers = await checkHasUsers(apiCtx);
      expect(hasUsers).toBe(true);
    } finally {
      await apiCtx.dispose();
    }

    await page.goto('/pages/register.html');

    const form = page.locator('#register-form');
    await expect(form).toBeHidden({ timeout: 10_000 });

    const closedMessage = page.locator('#registration-closed-message');
    await expect(closedMessage).toBeVisible();
  });

  test('POST /api/auth/register returns 403 REGISTRATION_CLOSED when users exist', async () => {
    const apiCtx = await request.newContext();
    try {
      const hasUsers = await checkHasUsers(apiCtx);
      expect(hasUsers).toBe(true);

      const res = await apiCtx.post(`${BASE_URL}/api/auth/register`, {
        data: {
          email: `e2e-second-attempt-${Date.now()}@test.com`,
          password: 'Password123!',
          first_name: 'Should',
          last_name: 'Reject',
          office_location: 'London',
        },
      });
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body && body.error && body.error.code).toBe('REGISTRATION_CLOSED');
    } finally {
      await apiCtx.dispose();
    }
  });
});
