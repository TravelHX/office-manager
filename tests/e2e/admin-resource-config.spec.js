// Phase 25.9 — End-to-end: admin sets up desks and parking spaces.
//
// Implements `docs/usecases.md` Use Case 4. Drives the Resource
// Configuration tab on /pages/admin.html through the browser:
//   1. Sign in as admin (token injected into localStorage).
//   2. Open the admin page; the Configuration tab is the default.
//   3. Read the current deskCount / parkingCount, increment each by 1
//      (so the test never tries to shrink below active bookings, which
//      the server rejects), submit the form via Save Configuration.
//   4. Confirm a success message renders and that the new counts have
//      taken effect via /api/admin/configuration.
//
// Each rerun bumps both counts by 1, so the test is monotonic on a
// long-lived stack: it never collides with itself but the resource
// counts grow over time. The server is happy with arbitrary increases.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';

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

async function getConfiguration(apiCtx, adminToken) {
  const res = await apiCtx.get(`${BASE_URL}/api/admin/configuration`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok()) throw new Error(`config fetch failed: ${res.status()}`);
  return await res.json();
}

test.describe('Admin configures desks and parking spaces (Phase 25.9, Use Case 4)', () => {
  let adminSession;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      adminSession = await ensureAdmin(apiCtx);
    } finally {
      await apiCtx.dispose();
    }
  });

  test('admin updates desk and parking counts via the Configuration tab', async ({ page }) => {
    const apiCtx = await request.newContext();
    let initial;
    try {
      initial = await getConfiguration(apiCtx, adminSession.token);
    } finally {
      await apiCtx.dispose();
    }

    const newDeskCount = (initial.deskCount || 0) + 1;
    const newParkingCount = (initial.parkingCount || 0) + 1;

    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: adminSession.token, u: adminSession.user }
    );

    await page.goto('/pages/admin.html');

    // The Configuration tab is the default; its inputs should be present.
    const deskCount = page.locator('#deskCount');
    const parkingCount = page.locator('#parkingCount');
    await expect(deskCount).toBeVisible({ timeout: 10_000 });
    await expect(parkingCount).toBeVisible();

    // Wait for admin.js to populate the form with current values before
    // overwriting; otherwise our fill happens before the page does and the
    // page subsequently overwrites it.
    await expect(deskCount).not.toHaveValue('', { timeout: 10_000 });
    await expect(parkingCount).not.toHaveValue('');

    await deskCount.fill(String(newDeskCount));
    await parkingCount.fill(String(newParkingCount));
    await page.locator('#saveConfigurationBtn').click();

    // The success path uses showNotification(...) which appends a
    // .notification.success div to #notification-container.
    const successToast = page.locator('#notification-container .notification.success');
    await expect(successToast).toContainText(/saved|updated|success/i, { timeout: 10_000 });

    // Authoritative check: the configuration API now returns the new counts.
    const apiCtx2 = await request.newContext();
    try {
      const after = await getConfiguration(apiCtx2, adminSession.token);
      expect(after.deskCount).toBe(newDeskCount);
      expect(after.parkingCount).toBe(newParkingCount);
    } finally {
      await apiCtx2.dispose();
    }
  });
});
