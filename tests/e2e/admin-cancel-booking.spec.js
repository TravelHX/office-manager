// Phase 25.9 — End-to-end: admin cancels another user's desk booking.
//
// Implements `docs/usecases.md` Use Case 5. The flow is:
//   1. Seed admin + regular user + at least one active desk.
//   2. As the regular user, create a booking via the API on a unique
//      future date.
//   3. Sign in as admin in the browser, open /pages/admin.html, switch
//      to the All Bookings tab.
//   4. Find the seeded booking row by its data-booking-id, accept the
//      reason prompt, and click the admin Cancel button.
//   5. Confirm the booking now shows status 'cancelled' via the API.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-admin-cancel-user@test.com';
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

async function ensureAtLeastOneDesk(apiCtx, adminToken) {
  const list = await apiCtx.get(`${BASE_URL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (list.ok()) {
    const desks = await list.json();
    const active = desks.filter((d) => d.isActive === true || d.isActive === 1);
    if (active.length >= 1) return active[0].id;
  }
  const setRes = await apiCtx.put(`${BASE_URL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: 1, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) throw new Error(`desk-count update failed: ${setRes.status()}`);
  const list2 = await apiCtx.get(`${BASE_URL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const desks2 = await list2.json();
  return desks2.filter((d) => d.isActive === true || d.isActive === 1)[0].id;
}

function uniqueFutureDate() {
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-05-${String(day).padStart(2, '0')}`;
}

test.describe('Admin cancels user desk booking (Phase 25.9, Use Case 5)', () => {
  let adminSession;
  let userSession;
  let seededBookingId;
  let bookingDate;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      adminSession = await ensureAdmin(apiCtx);
      const deskId = await ensureAtLeastOneDesk(apiCtx, adminSession.token);
      userSession = await ensureProvisionedUser(
        apiCtx,
        adminSession.token,
        USER_EMAIL,
        USER_PASSWORD,
        'E2E Admin Cancel User'
      );
      bookingDate = uniqueFutureDate();

      const book = await apiCtx.post(`${BASE_URL}/api/bookings`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
        data: { deskId, startDate: bookingDate, endDate: bookingDate },
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

  test('admin cancels a user booking from the All Bookings tab', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: adminSession.token, u: adminSession.user }
    );

    // The cancellation flow uses window.prompt() to read an optional reason.
    // Auto-accept it with a fixed string so the request fires.
    page.on('dialog', (dialog) => dialog.accept('E2E admin cancel'));

    await page.goto('/pages/admin.html');

    // All Bookings is a sidebar tab; the button has data-tab="bookings".
    await page.locator('button[data-tab="bookings"]').click();

    const allBookingsContainer = page.locator('#all-bookings-container');
    await expect(allBookingsContainer).toBeVisible();

    const cancelBtn = page.locator(`.admin-cancel-booking-btn[data-booking-id="${seededBookingId}"]`);
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    // The success notification appears via the global notification system.
    const successToast = page.locator('#notification-container .notification.success');
    await expect(successToast).toContainText(/cancelled successfully/i, { timeout: 10_000 });

    // Authoritative API check: the booking is now cancelled and the user
    // sees it as cancelled in their own My Bookings list.
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.get(`${BASE_URL}/api/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
      });
      expect(res.ok()).toBeTruthy();
      const bookings = await res.json();
      const seeded = bookings.find((b) => b.id === seededBookingId);
      expect(seeded).toBeDefined();
      expect(seeded.status).toBe('cancelled');
    } finally {
      await apiCtx.dispose();
    }
  });
});
