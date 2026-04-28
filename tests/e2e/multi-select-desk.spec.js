// Phase 25.5 — End-to-end: multi-select desk booking flow.
//
// Covers the deferred Playwright task from Phase 15 (multi-select bookings).
// The non-Playwright coverage already in the repo:
//   - src/frontend/tests/desk-booking.test.js (unit: render, toggle, count)
//   - tests/integration/* (POST /api/bookings/bulk happy + edge paths)
//   - usecase 10 in docs/usecases.md
// What was missing is a real-browser end-to-end run of the manual path.
//
// Flow validated:
//   1. Seed admin + regular user + at least 3 active desks via API.
//   2. Log into the browser as the regular user (localStorage token injection
//      mirrors audit.spec.js / undo-cancel.spec.js).
//   3. Open /pages/desk-booking.html, set a far-future date range, click
//      Check Availability.
//   4. Click Select on three desk cards. Confirm:
//        - each card flips to .selected with a "Selected" indicator;
//        - the per-card Book button becomes hidden;
//        - the bulk control reads "3 desks selected" and Book Selected is
//          enabled.
//   5. Click Book Selected. Confirm the page redirects to /pages/bookings.html
//      and the three new desk bookings (matching the seeded date range) are
//      rendered.
//
// Idempotency: every booking is scoped to a far-future date that incorporates
// the current Unix-second remainder so reruns don't collide with each other.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-multi-desk-user@test.com';
const USER_PASSWORD = 'Password123!';
const REQUIRED_DESK_COUNT = 3;

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
  throw new Error('No admin session available for e2e multi-select-desk test; start the stack with a clean DB.');
}

async function ensureRegularUser(apiCtx, baseURL, adminToken) {
  const existing = await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
  if (existing) return existing;

  const prov = await apiCtx.post(`${baseURL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: USER_EMAIL, name: 'E2E Multi Desk User' },
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
  // Bump desk count to at least n.
  const setRes = await apiCtx.put(`${baseURL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: n, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) {
    const body = await setRes.text();
    throw new Error(`desk-count update failed: ${setRes.status()} ${body}`);
  }
}

function uniqueFutureDate() {
  // Far-future date with a per-run jitter so concurrent reruns don't collide.
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-11-${String(day).padStart(2, '0')}`;
}

test.describe('Multi-select desk booking (Phase 25.5)', () => {
  let userSession;
  let bookingDate;

  test.beforeAll(async () => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const apiCtx = await request.newContext();
    try {
      const admin = await ensureAdmin(apiCtx, baseURL);
      await ensureAtLeastNDesks(apiCtx, baseURL, admin.token, REQUIRED_DESK_COUNT);
      userSession = await ensureRegularUser(apiCtx, baseURL, admin.token);
      bookingDate = uniqueFutureDate();
    } finally {
      await apiCtx.dispose();
    }
  });

  test('select three desks and Book Selected creates three bookings', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: userSession.user }
    );

    await page.goto('/pages/desk-booking.html');

    await page.locator('#startDate').fill(bookingDate);
    await page.locator('#endDate').fill(bookingDate);
    await page.locator('#checkAvailabilityBtn').click();

    // The desk container renders the cards, including the bulk selection bar.
    const desksContainer = page.locator('#desks-container');
    await expect(desksContainer).toBeVisible();
    const deskCards = page.locator('.desk-card[data-desk-id]');
    await expect(deskCards.nth(REQUIRED_DESK_COUNT - 1)).toBeVisible({ timeout: 10_000 });

    // Capture the desk numbers we are about to select so we can assert on
    // them in My Bookings without depending on internal IDs.
    const selectedDeskIds = [];
    for (let i = 0; i < REQUIRED_DESK_COUNT; i++) {
      const card = deskCards.nth(i);
      const id = await card.getAttribute('data-desk-id');
      selectedDeskIds.push(id);
      await card.locator('.select-desk-btn').click();
      await expect(card).toHaveClass(/selected/);
      await expect(card.locator('.selection-indicator')).toBeVisible();
      await expect(card.locator('.book-desk-btn')).toBeHidden();
    }

    const selectionCount = page.locator('#selection-count');
    await expect(selectionCount).toHaveText(`${REQUIRED_DESK_COUNT} desks selected`);

    const bookSelectedBtn = page.locator('#book-selected-btn');
    await expect(bookSelectedBtn).toBeEnabled();

    // The handler issues POST /api/bookings/bulk and then redirects after a
    // brief success-message delay. Wait for the URL change rather than the
    // toast (the toast is a transient div).
    await Promise.all([
      page.waitForURL(/\/pages\/bookings\.html$/, { timeout: 15_000 }),
      bookSelectedBtn.click(),
    ]);

    // My Bookings page rendered. Confirm the bookings container is visible
    // (purely cosmetic — the post-redirect render path).
    const bookingsContainer = page.locator('#bookings-container');
    await expect(bookingsContainer).toBeVisible();

    // Verify the three bookings landed in the database via the same API
    // that the page calls. Asserting by raw startDate avoids the locale
    // pitfalls of the rendered "Nov X, 2099" cell text.
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.get(`${process.env.E2E_BASE_URL || 'http://localhost:3000'}/api/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
      });
      expect(res.ok()).toBeTruthy();
      const bookings = await res.json();
      // mysql2 returns DATE columns as Date objects; JSON serialises those
      // as full ISO timestamps (e.g. "2099-11-15T00:00:00.000Z"). Normalise
      // to YYYY-MM-DD before comparing so we tolerate either format.
      const dateOf = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');
      const seededRows = bookings.filter(
        (b) => dateOf(b.startDate) === bookingDate && b.status === 'active' && selectedDeskIds.includes(String(b.deskId))
      );
      expect(seededRows.length).toBe(REQUIRED_DESK_COUNT);
    } finally {
      await apiCtx.dispose();
    }
  });
});
