// Phase 25.9 — End-to-end: book a desk and a parking space (half-day).
//
// Implements `docs/usecases.md` Use Case 2. The current desk-booking page
// only models a date range — there is no per-period (morning / afternoon)
// selector for desks. Parking does have a period selector. The use case
// in practice is therefore: a user books a desk on a single date AND
// reserves a parking space on the same date for a half-day period
// (morning), via two consecutive flows. After both submissions the user
// should see one desk booking and one parking reservation in My Bookings.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-desk-parking-user@test.com';
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
    if (!reg.ok()) {
      throw new Error(`register admin failed: ${reg.status()}`);
    }
    return await reg.json();
  }
  throw new Error('No admin session available; bring up the stack with a clean DB.');
}

async function ensureRegularUser(apiCtx, adminToken) {
  const existing = await loginAsOrNull(apiCtx, USER_EMAIL, USER_PASSWORD);
  if (existing) return existing;

  const prov = await apiCtx.post(`${BASE_URL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: USER_EMAIL, name: 'E2E Desk Parking User' },
  });
  if (!prov.ok()) throw new Error(`provision user failed: ${prov.status()}`);
  const body = await prov.json();
  const complete = await apiCtx.post(`${BASE_URL}/api/auth/complete-profile`, {
    data: { token: body.invitationToken, password: USER_PASSWORD, office_location: 'London' },
  });
  if (!complete.ok()) throw new Error(`complete-profile failed: ${complete.status()}`);
  return await loginAsOrNull(apiCtx, USER_EMAIL, USER_PASSWORD);
}

async function ensureAtLeastOneDesk(apiCtx, adminToken) {
  const list = await apiCtx.get(`${BASE_URL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (list.ok()) {
    const desks = await list.json();
    if (desks.some((d) => d.isActive === true || d.isActive === 1)) return;
  }
  const setRes = await apiCtx.put(`${BASE_URL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: 1, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) throw new Error(`desk-count update failed: ${setRes.status()}`);
}

async function ensureAtLeastOneParkingSpace(apiCtx, adminToken) {
  const list = await apiCtx.get(`${BASE_URL}/api/admin/parking-spaces`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (list.ok()) {
    const spaces = await list.json();
    if (spaces.some((s) => s.isActive === true || s.isActive === 1)) return;
  }
  const setRes = await apiCtx.put(`${BASE_URL}/api/admin/configuration/parking-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { parkingCount: 1, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) throw new Error(`parking-count update failed: ${setRes.status()}`);
}

function uniqueFutureDate() {
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-07-${String(day).padStart(2, '0')}`;
}

test.describe('Desk + parking on the same date (Phase 25.9, Use Case 2)', () => {
  let userSession;
  let bookingDate;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      const admin = await ensureAdmin(apiCtx);
      await ensureAtLeastOneDesk(apiCtx, admin.token);
      await ensureAtLeastOneParkingSpace(apiCtx, admin.token);
      userSession = await ensureRegularUser(apiCtx, admin.token);
      bookingDate = uniqueFutureDate();
    } finally {
      await apiCtx.dispose();
    }
  });

  test('book a desk for the day, then reserve a parking space (morning) on the same date', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: userSession.user }
    );

    // 1) Desk booking on bookingDate (single day, single desk).
    await page.goto('/pages/desk-booking.html');
    await page.locator('#startDate').fill(bookingDate);
    await page.locator('#endDate').fill(bookingDate);
    await page.locator('#checkAvailabilityBtn').click();

    const deskCards = page.locator('.desk-card[data-desk-id]');
    await expect(deskCards.first()).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForURL(/\/pages\/bookings\.html$/, { timeout: 15_000 }),
      deskCards.first().locator('.book-desk-btn').click(),
    ]);

    // 2) Parking reservation on the same date, morning period.
    await page.goto('/pages/parking.html');
    await page.locator('#reservationDate').fill(bookingDate);
    await page.locator('#timePeriod').selectOption('morning');
    await page.locator('#checkAvailabilityBtn').click();

    const spaceCards = page.locator('.desk-card[data-space-id]');
    await expect(spaceCards.first()).toBeVisible({ timeout: 10_000 });
    await Promise.all([
      page.waitForURL(/\/pages\/bookings\.html$/, { timeout: 15_000 }),
      spaceCards.first().locator('.book-space-btn').click(),
    ]);

    // Verify both via API: one active desk booking and one active parking
    // reservation, both on bookingDate (parking with morning period).
    const apiCtx = await request.newContext();
    try {
      const dateOf = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');

      const dRes = await apiCtx.get(`${BASE_URL}/api/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
      });
      expect(dRes.ok()).toBeTruthy();
      const bookings = await dRes.json();
      const seededDesks = bookings.filter(
        (b) => dateOf(b.startDate) === bookingDate && b.status === 'active'
      );
      expect(seededDesks.length).toBe(1);

      const pRes = await apiCtx.get(`${BASE_URL}/api/parking-reservations/my-reservations`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
      });
      expect(pRes.ok()).toBeTruthy();
      const reservations = await pRes.json();
      const seededParking = reservations.filter(
        (r) =>
          dateOf(r.reservationDate) === bookingDate &&
          (r.status === 'active' || r.status === undefined) &&
          r.timePeriod === 'morning'
      );
      expect(seededParking.length).toBe(1);
    } finally {
      await apiCtx.dispose();
    }
  });
});
