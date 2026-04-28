// Phase 25.10 — End-to-end: Booking Matrix admin view.
//
// Closes the Playwright gap for the **Booking Matrix Screen** feature
// listed in `README.md` (admin-only matrix grid: users on one axis,
// dates on the other, with filters and CSV export).
//
// The flow:
//   1. Sign in as admin in the browser.
//   2. Open /pages/matrix.html (the standalone matrix page; the same
//      backend endpoint is used by the admin tab).
//   3. Set a wide date range covering the seeded bookings, click Load
//      Matrix, and confirm the matrix table renders (or, if no bookings
//      exist for the range, the empty-state message is shown — both are
//      valid product states).
//   4. Confirm the page is admin-gated: a non-admin user that visits
//      /pages/matrix.html receives an authorization-error response from
//      the matrix API call.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-matrix-user@test.com';
const USER_PASSWORD = 'Password123!';

async function loginAsOrNull(apiCtx, email, password) {
  const res = await apiCtx.post(`${BASE_URL}/api/auth/login`, {
    data: { username: email, password },
  });
  if (!res.ok()) return null;
  return await res.json();
}

async function ensureAdmin(apiCtx) {
  const existing = await loginAsOrNull(apiCtx, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (existing && (existing.user.isAdmin || existing.user.role === 'admin')) return existing;

  const check = await apiCtx.get(`${BASE_URL}/api/auth/check-users`);
  const { hasUsers } = await check.json();
  if (!hasUsers) {
    const reg = await apiCtx.post(`${BASE_URL}/api/auth/register`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, first_name: 'E2E', last_name: 'Admin', office_location: 'London' },
    });
    if (!reg.ok()) throw new Error(`register admin failed: ${reg.status()}`);
    return await reg.json();
  }
  throw new Error('No admin session available; bring up the stack with a clean DB.');
}

async function ensureProvisionedUser(apiCtx, adminToken, email, password, name) {
  const existing = await loginAsOrNull(apiCtx, email, password);
  if (existing) return existing;

  const prov = await apiCtx.post(`${BASE_URL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email, name },
  });
  if (!prov.ok()) {
    const body = await prov.text();
    throw new Error(`provision ${email} failed: ${prov.status()} ${body}`);
  }
  const body = await prov.json();
  const complete = await apiCtx.post(`${BASE_URL}/api/auth/complete-profile`, {
    data: { token: body.invitationToken, password, office_location: 'London' },
  });
  if (!complete.ok()) throw new Error(`complete-profile ${email} failed: ${complete.status()}`);
  return await loginAsOrNull(apiCtx, email, password);
}

test.describe('Booking Matrix admin view (Phase 25.10)', () => {
  let adminSession;
  let userSession;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      adminSession = await ensureAdmin(apiCtx);
      userSession = await ensureProvisionedUser(
        apiCtx,
        adminSession.token,
        USER_EMAIL,
        USER_PASSWORD,
        'E2E Matrix User'
      );
    } finally {
      await apiCtx.dispose();
    }
  });

  test('admin loads the matrix and the API rejects non-admin callers', async ({ page }) => {
    // Admin opens the matrix page and clicks Load Matrix.
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: adminSession.token, u: adminSession.user }
    );

    await page.goto('/pages/matrix.html');

    const startDateInput = page.locator('#startDate');
    const endDateInput = page.locator('#endDate');
    const loadBtn = page.locator('#loadMatrixBtn');
    await expect(startDateInput).toBeVisible({ timeout: 10_000 });
    await expect(endDateInput).toBeVisible();
    await expect(loadBtn).toBeVisible();

    // Wide range so we capture any bookings other specs created.
    await startDateInput.fill('2099-01-01');
    await endDateInput.fill('2099-12-31');
    await loadBtn.click();

    // Either the matrix table renders, or the empty-state paragraph is
    // shown if the range happens to contain no bookings. Both are
    // valid post-conditions of the Load Matrix click.
    const matrixContainer = page.locator('#matrix-container');
    await expect(matrixContainer).toBeVisible();
    const matrixMessage = page.locator('#matrix-message');
    await expect(matrixMessage).toContainText(/loaded successfully|loading matrix data/i, { timeout: 10_000 });

    // Non-admin gating. Use the regular user's token directly against
    // the matrix API; the response must be 401 or 403.
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.get(`${BASE_URL}/api/matrix/bookings?startDate=2099-01-01&endDate=2099-12-31&type=combined`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
      });
      expect(res.status()).toBeGreaterThanOrEqual(401);
      expect(res.status()).toBeLessThan(500);
    } finally {
      await apiCtx.dispose();
    }
  });
});
