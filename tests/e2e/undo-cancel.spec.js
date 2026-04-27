// Phase 23c E2E: user cancels their own desk booking, sees the Undo toast,
// clicks Undo within the window, and the booking is restored.
//
// Browser-driven flow:
//   1. Seed or reuse an admin (first-user admin pattern).
//   2. Seed a regular user and a booking for a fixed future date via API.
//   3. Log in as the regular user in the browser (localStorage token
//      injection — same technique as audit.spec.js).
//   4. Open /pages/bookings.html.
//   5. Click Cancel on the newly-created booking, accept the confirm.
//   6. Expect the undo toast to appear. Click Undo.
//   7. Expect the booking to re-appear with status "active" in My Bookings.
//
// Tolerates a dirty stack by scoping to a uniquely-dated booking and
// matching the specific row via the seeded date string.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-undo-user@test.com';
const USER_PASSWORD = 'Password123!';

async function loginAsOrNull(apiCtx, baseURL, email, password) {
  const res = await apiCtx.post(`${baseURL}/api/auth/login`, {
    data: { username: email, password },
  });
  if (!res.ok()) return null;
  return await res.json();
}

async function ensureAdmin(apiCtx, baseURL) {
  const existing = await loginAsOrNull(apiCtx, baseURL, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (existing && (existing.user.isAdmin || existing.user.role === 'admin')) return existing;

  const check = await apiCtx.get(`${baseURL}/api/auth/check-users`);
  const { hasUsers } = await check.json();
  if (!hasUsers) {
    const reg = await apiCtx.post(`${baseURL}/api/auth/register`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, first_name: 'E2E', last_name: 'Admin', office_location: 'London' },
    });
    if (!reg.ok()) {
      throw new Error(`register admin failed: ${reg.status()}`);
    }
    return await reg.json();
  }
  throw new Error('No admin session available for e2e undo-cancel test; start the stack with a clean DB.');
}

async function ensureRegularUser(apiCtx, baseURL, adminToken) {
  const existing = await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
  if (existing) return existing;

  const prov = await apiCtx.post(`${baseURL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: USER_EMAIL, name: 'E2E Undo User' },
  });
  if (!prov.ok()) {
    const body = await prov.text();
    throw new Error(`provision user failed: ${prov.status()} ${body}`);
  }
  const body = await prov.json();
  const invitationToken = body.invitationToken;

  const complete = await apiCtx.post(`${baseURL}/api/auth/complete-profile`, {
    data: { token: invitationToken, password: USER_PASSWORD, office_location: 'London' },
  });
  if (!complete.ok()) {
    throw new Error(`complete-profile failed: ${complete.status()}`);
  }
  return await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
}

async function ensureDeskId(apiCtx, baseURL, adminToken) {
  const res = await apiCtx.get(`${baseURL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (res.ok()) {
    const desks = await res.json();
    const active = desks.find((d) => d.isActive === true || d.isActive === 1);
    if (active) return active.id;
  }
  // As a last resort, bump desk count by 1 to create one.
  await apiCtx.put(`${baseURL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: 1, numberingMode: 'auto', startNumber: 1 },
  });
  const again = await apiCtx.get(`${baseURL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const desks = await again.json();
  return desks[0].id;
}

test.describe('Undo desk cancel (Phase 23c / task 23.15)', () => {
  let adminToken;
  let userSession;
  let seededBookingId;
  let seededDate;

  test.beforeAll(async () => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const apiCtx = await request.newContext();
    try {
      const admin = await ensureAdmin(apiCtx, baseURL);
      adminToken = admin.token;
      userSession = await ensureRegularUser(apiCtx, baseURL, adminToken);
      const deskId = await ensureDeskId(apiCtx, baseURL, adminToken);

      // Seed a booking on a uniquely-far future date so the row is unambiguous
      // in the rendered table even on a dirty DB.
      seededDate = `2099-1${String((Date.now() % 9) + 1).padStart(1, '0')}-2${String((Date.now() % 8) + 1)}`;
      // Simplify: just use the last two digits of `now` to pick a day.
      const day = (Date.now() % 27) + 1;
      seededDate = `2099-12-${String(day).padStart(2, '0')}`;

      const book = await apiCtx.post(`${baseURL}/api/bookings`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
        data: { deskId, startDate: seededDate, endDate: seededDate },
      });
      if (!book.ok()) {
        const body = await book.text();
        throw new Error(`seed booking failed: ${book.status()} ${body}`);
      }
      const booking = await book.json();
      seededBookingId = booking.id;
    } finally {
      await apiCtx.dispose();
    }
  });

  test('cancel + Undo restores the booking within the window', async ({ page }) => {
    const user = userSession.user;
    const sessionUser = { ...user };
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: sessionUser }
    );

    // Accept the native confirm() dialog used by cancelBooking.
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto('/pages/bookings.html');

    const container = page.locator('#bookings-container');
    await expect(container).toBeVisible();

    // Find the cancel button for the seeded booking id.
    const cancelBtn = page.locator(`.cancel-booking-btn[data-booking-id="${seededBookingId}"]`);
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    // Toast appears.
    const toast = page.locator('#undo-cancel-toast');
    await expect(toast).toBeVisible({ timeout: 5_000 });
    await expect(toast).toContainText(/Booking cancelled/i);

    const undoBtn = page.locator('#undo-cancel-btn');
    await expect(undoBtn).toHaveAttribute('data-booking-id', String(seededBookingId));
    await undoBtn.click();

    // Toast should go away and the row should still be there (active again).
    await expect(toast).toBeHidden({ timeout: 5_000 });

    // The cancel button for the restored booking should be visible again
    // (active bookings render a Cancel button; cancelled ones don't).
    await expect(
      page.locator(`.cancel-booking-btn[data-booking-id="${seededBookingId}"]`)
    ).toBeVisible({ timeout: 5_000 });
  });
});
