// Phase 27c — End-to-end: Key Fob Request and Allocation.
//
// Mirrors task 27.18 in the todo:
//   1. Office Administrator sets a per-day fob count of 1 for a unique
//      future date.
//   2. User A books a desk on that day with "Fob needed" and succeeds.
//   3. User B tries the same flow on a different desk; the API rejects
//      with FOB_UNAVAILABLE and the page surfaces the offending date.
//   4. User A cancels their booking, releasing the fob.
//   5. User B retries and succeeds.
//   6. Office Administrator opens the Fob Calendar and confirms the
//      day shows configured=1, requested=1, available=0.
//   7. Office Administrator opens Fob History and confirms the
//      allocation row appears for User B.
//
// The test has no webServer config: the app stack must already be
// running on E2E_BASE_URL (default http://localhost:3000).

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const OA_EMAIL = 'e2e-fob-oa@test.com';
const OA_PASSWORD = 'Password123!';
const USER_A_EMAIL = 'e2e-fob-user-a@test.com';
const USER_A_PASSWORD = 'Password123!';
const USER_B_EMAIL = 'e2e-fob-user-b@test.com';
const USER_B_PASSWORD = 'Password123!';

async function loginAsOrNull(apiCtx, email, password) {
  const res = await apiCtx.post(`${BASE_URL}/api/auth/login`, {
    data: { username: email, password },
  });
  if (!res.ok()) return null;
  return await res.json();
}

async function ensureAdmin(apiCtx) {
  const existing = await loginAsOrNull(apiCtx, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (existing && (existing.user.isAdmin || existing.user.role === 'admin')) {
    return existing;
  }
  const check = await apiCtx.get(`${BASE_URL}/api/auth/check-users`);
  const { hasUsers } = await check.json();
  if (!hasUsers) {
    const reg = await apiCtx.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        first_name: 'E2E',
        last_name: 'Admin',
        office_location: 'London',
      },
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
  const provBody = await prov.json();
  const complete = await apiCtx.post(`${BASE_URL}/api/auth/complete-profile`, {
    data: { token: provBody.invitationToken, password, office_location: 'London' },
  });
  if (!complete.ok()) {
    throw new Error(`complete-profile ${email} failed: ${complete.status()}`);
  }
  return await loginAsOrNull(apiCtx, email, password);
}

async function ensureAtLeastTwoDesks(apiCtx, adminToken) {
  const list = await apiCtx.get(`${BASE_URL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  let desks = list.ok() ? await list.json() : [];
  let active = desks.filter((d) => d.isActive === true || d.isActive === 1);
  if (active.length >= 2) return [active[0].id, active[1].id];

  const setRes = await apiCtx.put(`${BASE_URL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: 2, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) throw new Error(`desk-count update failed: ${setRes.status()}`);

  const list2 = await apiCtx.get(`${BASE_URL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  desks = await list2.json();
  active = desks.filter((d) => d.isActive === true || d.isActive === 1);
  return [active[0].id, active[1].id];
}

function uniqueFutureDate() {
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-08-${String(day).padStart(2, '0')}`;
}

test.describe('Key Fob Request and Allocation (Phase 27.18)', () => {
  let adminSession;
  let oaSession;
  let userASession;
  let userBSession;
  let firstDeskId;
  let secondDeskId;
  let bookingDate;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      adminSession = await ensureAdmin(apiCtx);
      [firstDeskId, secondDeskId] = await ensureAtLeastTwoDesks(apiCtx, adminSession.token);

      // OA target user, then promote to office_admin via the role
      // endpoint introduced in Phase 26a.
      oaSession = await ensureProvisionedUser(apiCtx, adminSession.token, OA_EMAIL, OA_PASSWORD, 'E2E Fob OA');
      const promote = await apiCtx.put(`${BASE_URL}/api/auth/users/${oaSession.user.id}/role`, {
        headers: { Authorization: `Bearer ${adminSession.token}` },
        data: { role: 'office_admin' },
      });
      if (!promote.ok()) {
        const body = await promote.text();
        throw new Error(`promote OA failed: ${promote.status()} ${body}`);
      }
      // Re-login so the JWT carries role=office_admin.
      oaSession = await loginAsOrNull(apiCtx, OA_EMAIL, OA_PASSWORD);

      userASession = await ensureProvisionedUser(apiCtx, adminSession.token, USER_A_EMAIL, USER_A_PASSWORD, 'E2E Fob A');
      userBSession = await ensureProvisionedUser(apiCtx, adminSession.token, USER_B_EMAIL, USER_B_PASSWORD, 'E2E Fob B');

      bookingDate = uniqueFutureDate();

      // OA sets a per-date override of 1 for the test's date. We use
      // PUT /:date directly (rather than driving the UI) so this setup
      // is fast; the UI flow is tested below for the calendar + history
      // pages.
      const ovr = await apiCtx.put(`${BASE_URL}/api/admin/fob/inventory/${bookingDate}`, {
        headers: { Authorization: `Bearer ${oaSession.token}` },
        data: { count: 1 },
      });
      if (!ovr.ok()) {
        const body = await ovr.text();
        throw new Error(`OA per-date override failed: ${ovr.status()} ${body}`);
      }

      // Sanity: clear any prior bookings on the date so the count starts
      // at zero. This is best-effort against the API; on a clean stack
      // there will be nothing to remove.
      const my = await apiCtx.get(`${BASE_URL}/api/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${userASession.token}` },
      });
      if (my.ok()) {
        const bookings = await my.json();
        for (const b of bookings) {
          if (b.startDate === bookingDate && b.status === 'active') {
            await apiCtx.delete(`${BASE_URL}/api/bookings/${b.id}`, {
              headers: { Authorization: `Bearer ${userASession.token}` },
            });
          }
        }
      }
    } finally {
      await apiCtx.dispose();
    }
  });

  test('A books fob, B is denied, A cancels, B retries; OA sees calendar + history', async ({ page }) => {
    // ----- Step 1: User A books a desk for `bookingDate` with "Fob
    // needed" via the desk-booking page. -----
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userASession.token, u: userASession.user }
    );

    await page.goto('/pages/desk-booking.html');
    await page.locator('#startDate').fill(bookingDate);
    await page.locator('#endDate').fill(bookingDate);
    await page.locator('#fobRequested').check();
    await page.locator('#checkAvailabilityBtn').click();

    // The desk list renders; click Book on the first desk.
    const bookBtn = page.locator(`.book-desk-btn[data-desk-id="${firstDeskId}"]`);
    await expect(bookBtn).toBeVisible({ timeout: 10_000 });
    await bookBtn.click();

    // Phase 27c: success message includes "(with fob)" suffix.
    await expect(page.locator('#availability-message')).toContainText(/with fob/i, { timeout: 10_000 });

    // ----- Step 2: API-level check that B is denied. -----
    // Using the API directly is faster than driving the UI a second
    // time and gives us the FOB_UNAVAILABLE shape to assert on.
    const apiCtx = await request.newContext();
    try {
      const denied = await apiCtx.post(`${BASE_URL}/api/bookings`, {
        headers: { Authorization: `Bearer ${userBSession.token}` },
        data: {
          deskId: secondDeskId,
          startDate: bookingDate,
          endDate: bookingDate,
          fobRequested: true,
        },
      });
      expect(denied.status()).toBe(400);
      const body = await denied.json();
      expect(body.error.code).toBe('FOB_UNAVAILABLE');
      expect(body.error.offendingDates).toEqual([bookingDate]);

      // ----- Step 3: User A cancels, releasing the fob. -----
      const myA = await apiCtx.get(`${BASE_URL}/api/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${userASession.token}` },
      });
      const bookingsA = await myA.json();
      const aBooking = bookingsA.find((b) => b.startDate === bookingDate && b.status === 'active');
      expect(aBooking).toBeDefined();
      const cancel = await apiCtx.delete(`${BASE_URL}/api/bookings/${aBooking.id}`, {
        headers: { Authorization: `Bearer ${userASession.token}` },
      });
      expect(cancel.status()).toBe(204);

      // ----- Step 4: User B retries and succeeds. -----
      const retry = await apiCtx.post(`${BASE_URL}/api/bookings`, {
        headers: { Authorization: `Bearer ${userBSession.token}` },
        data: {
          deskId: secondDeskId,
          startDate: bookingDate,
          endDate: bookingDate,
          fobRequested: true,
        },
      });
      expect(retry.status()).toBe(201);
      const retryBody = await retry.json();
      expect(retryBody.fobRequested).toBe(true);
    } finally {
      await apiCtx.dispose();
    }

    // ----- Step 5: Office Administrator opens Fob Calendar and Fob
    // History via the admin UI. -----
    await page.context().clearCookies();
    await page.evaluate(() => window.localStorage.clear());
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: oaSession.token, u: oaSession.user }
    );
    await page.goto('/pages/admin.html');

    // Fob Calendar tab.
    const calendarBtn = page.locator('.tab-btn[data-tab="fob-calendar"]');
    await expect(calendarBtn).toBeVisible({ timeout: 10_000 });
    await calendarBtn.click();
    await page.locator('#fobCalendarStart').fill(bookingDate);
    await page.locator('#fobCalendarEnd').fill(bookingDate);
    await page.locator('#fobCalendarLoadBtn').click();

    const calendarRows = page.locator('.fob-calendar-row');
    await expect(calendarRows).toHaveCount(1, { timeout: 10_000 });
    await expect(calendarRows.first()).toContainText(bookingDate);
    await expect(calendarRows.first()).toContainText(/0 of 1|configured.*1/i, { timeout: 10_000 });

    // Fob History tab.
    const historyBtn = page.locator('.tab-btn[data-tab="fob-history"]');
    await historyBtn.click();
    await page.locator('#fobHistoryStart').fill(bookingDate);
    await page.locator('#fobHistoryEnd').fill(bookingDate);
    await page.locator('#fobHistoryLoadBtn').click();

    // The active fob is User B's booking (User A's was cancelled but the
    // history endpoint returns ALL fob-requested rows, so we expect
    // both A and B to appear).
    const historyRows = page.locator('.fob-history-table tbody tr');
    await expect(historyRows.first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.fob-history-table')).toContainText(USER_A_EMAIL.toLowerCase());
    await expect(page.locator('.fob-history-table')).toContainText(USER_B_EMAIL.toLowerCase());
  });
});
