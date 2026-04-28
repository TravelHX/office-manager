// Phase 25.7 — End-to-end: mixed single + multi-select desk booking flow.
//
// Use case 10's "single Book remains available" branch: with desks already
// laid out on the page, a per-card Book button (.book-desk-btn) posts to
// POST /api/bookings without involving the multi-select state. After that
// single booking succeeds the user is redirected to My Bookings.
//
// This test validates the contract that the per-card Book and the bulk
// "Book Selected" both work in the same browser flow without interfering.
// The two paths use different dates because BookingService rejects a user
// holding multiple desk bookings on overlapping dates — a constraint that
// is orthogonal to the multi-select wiring this test exercises:
//   1. Seed admin + regular user + at least 4 active desks.
//   2. Log in as the user, open desk-booking, set date A (single-booking
//      window).
//   3. Click Book on the FIRST desk card (per-card single-resource path).
//      Wait for redirect to /pages/bookings.html. Confirm exactly one
//      booking exists for date A via the API.
//   4. Navigate back to desk-booking, set date B (a different far-future
//      date so it does not overlap date A). Run availability. Click Select
//      on three desks; the per-card Book on those desks must hide; the
//      bulk "Book Selected" control should report a count of 3 and become
//      enabled. Click Book Selected.
//   5. Confirm exactly three more bookings now exist for date B, leaving
//      one booking for date A and three for date B (four total).
//
// Idempotency: the two seeded dates are far-future with per-run jitter and
// distinct months so the windows never overlap and reruns do not collide.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-mixed-desk-user@test.com';
const USER_PASSWORD = 'Password123!';
const REQUIRED_DESK_COUNT = 4;
const MULTI_SELECT_COUNT = 3;

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
  throw new Error('No admin session available for e2e mixed-single-multi test; start the stack with a clean DB.');
}

async function ensureRegularUser(apiCtx, baseURL, adminToken) {
  const existing = await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
  if (existing) return existing;

  const prov = await apiCtx.post(`${baseURL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: USER_EMAIL, name: 'E2E Mixed Desk User' },
  });
  if (!prov.ok()) {
    const body = await prov.text();
    throw new Error(`provision user failed: ${prov.status()} ${body}`);
  }
  const body = await prov.json();
  const complete = await apiCtx.post(`${baseURL}/api/auth/complete-profile`, {
    data: { token: body.invitationToken, password: USER_PASSWORD, office_location: 'London' },
  });
  if (!complete.ok()) {
    throw new Error(`complete-profile failed: ${complete.status()}`);
  }
  return await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
}

async function ensureAtLeastNDesks(apiCtx, baseURL, adminToken, n) {
  const list = await apiCtx.get(`${baseURL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (list.ok()) {
    const desks = await list.json();
    const active = desks.filter((d) => d.isActive === true || d.isActive === 1);
    if (active.length >= n) return;
  }
  const setRes = await apiCtx.put(`${baseURL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: n, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) {
    const body = await setRes.text();
    throw new Error(`desk-count update failed: ${setRes.status()} ${body}`);
  }
}

function uniqueFutureDate(month) {
  // month: zero-padded MM string. Two callers pick different months so the
  // single-booking date and the multi-booking date never overlap.
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-${month}-${String(day).padStart(2, '0')}`;
}

async function countSeededBookings(baseURL, token, date) {
  const apiCtx = await request.newContext();
  try {
    const res = await apiCtx.get(`${baseURL}/api/bookings/my-bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok()) {
      throw new Error(`my-bookings fetch failed: ${res.status()}`);
    }
    const bookings = await res.json();
    const dateOf = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');
    return bookings.filter((b) => dateOf(b.startDate) === date && b.status === 'active');
  } finally {
    await apiCtx.dispose();
  }
}

test.describe('Mixed single + multi-select desk booking (Phase 25.7)', () => {
  let userSession;
  let singleBookingDate;
  let multiBookingDate;
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      const admin = await ensureAdmin(apiCtx, baseURL);
      await ensureAtLeastNDesks(apiCtx, baseURL, admin.token, REQUIRED_DESK_COUNT);
      userSession = await ensureRegularUser(apiCtx, baseURL, admin.token);
      // Different months so the single-booking and multi-booking date
      // ranges never overlap (BookingService blocks overlapping per-user
      // desk bookings — a constraint unrelated to multi-select wiring).
      singleBookingDate = uniqueFutureDate('08');
      multiBookingDate = uniqueFutureDate('09');
    } finally {
      await apiCtx.dispose();
    }
  });

  test('per-card Book and Book Selected create independent bookings', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: userSession.user }
    );

    // Step 3: per-card single Book on date A.
    await page.goto('/pages/desk-booking.html');
    await page.locator('#startDate').fill(singleBookingDate);
    await page.locator('#endDate').fill(singleBookingDate);
    await page.locator('#checkAvailabilityBtn').click();

    const deskCardsForSingle = page.locator('.desk-card[data-desk-id]');
    await expect(deskCardsForSingle.first()).toBeVisible({ timeout: 10_000 });
    const singleBookedDeskId = await deskCardsForSingle.first().getAttribute('data-desk-id');
    expect(singleBookedDeskId).toBeTruthy();

    await Promise.all([
      page.waitForURL(/\/pages\/bookings\.html$/, { timeout: 15_000 }),
      deskCardsForSingle.first().locator('.book-desk-btn').click(),
    ]);

    const singleSeeded = await countSeededBookings(baseURL, userSession.token, singleBookingDate);
    expect(singleSeeded.length).toBe(1);
    expect(String(singleSeeded[0].deskId)).toBe(singleBookedDeskId);

    // Step 4: open desk-booking on date B (does not overlap date A) and
    // run multi-select Book Selected.
    await page.goto('/pages/desk-booking.html');
    await page.locator('#startDate').fill(multiBookingDate);
    await page.locator('#endDate').fill(multiBookingDate);
    await page.locator('#checkAvailabilityBtn').click();

    const deskCardsForMulti = page.locator('.desk-card[data-desk-id]');
    await expect(deskCardsForMulti.nth(MULTI_SELECT_COUNT - 1)).toBeVisible({ timeout: 10_000 });

    const allMultiCardIds = await deskCardsForMulti.evaluateAll((cards) =>
      cards.map((c) => c.getAttribute('data-desk-id'))
    );
    const selectedDeskIds = allMultiCardIds.slice(0, MULTI_SELECT_COUNT);
    for (const id of selectedDeskIds) {
      const card = page.locator(`.desk-card[data-desk-id="${id}"]`);
      await card.locator('.select-desk-btn').click();
      await expect(card).toHaveClass(/selected/);
      await expect(card.locator('.book-desk-btn')).toBeHidden();
    }

    await expect(page.locator('#selection-count')).toHaveText(`${MULTI_SELECT_COUNT} desks selected`);

    const bookSelectedBtn = page.locator('#book-selected-btn');
    await expect(bookSelectedBtn).toBeEnabled();
    await Promise.all([
      page.waitForURL(/\/pages\/bookings\.html$/, { timeout: 15_000 }),
      bookSelectedBtn.click(),
    ]);

    const multiSeeded = await countSeededBookings(baseURL, userSession.token, multiBookingDate);
    expect(multiSeeded.length).toBe(MULTI_SELECT_COUNT);
    const bookedMultiDeskIds = multiSeeded.map((b) => String(b.deskId)).sort();
    expect(bookedMultiDeskIds).toEqual([...selectedDeskIds].sort());

    // And the date-A booking is still present, untouched by the bulk run.
    const stillSingle = await countSeededBookings(baseURL, userSession.token, singleBookingDate);
    expect(stillSingle.length).toBe(1);
    expect(String(stillSingle[0].deskId)).toBe(singleBookedDeskId);
  });
});
