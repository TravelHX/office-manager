// Phase 25.6 — End-to-end: multi-select parking booking flow.
//
// Mirrors tests/e2e/multi-select-desk.spec.js for the parking page. The
// parking flow uses a single date plus a time-period select (morning /
// afternoon / full_day) instead of a date range, and renders cards in a
// container keyed on data-space-id with a #reserve-selected-btn bulk
// control. POST target is /api/parking-reservations/bulk.
//
// Idempotency: the seeded date is far-future and includes a per-run jitter
// so reruns do not collide.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-multi-parking-user@test.com';
const USER_PASSWORD = 'Password123!';
const REQUIRED_SPACE_COUNT = 3;

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
  throw new Error('No admin session available for e2e multi-select-parking test; start the stack with a clean DB.');
}

async function ensureRegularUser(apiCtx, baseURL, adminToken) {
  const existing = await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
  if (existing) return existing;

  const prov = await apiCtx.post(`${baseURL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: USER_EMAIL, name: 'E2E Multi Parking User' },
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

async function ensureAtLeastNParkingSpaces(apiCtx, baseURL, adminToken, n) {
  const list = await apiCtx.get(`${baseURL}/api/admin/parking-spaces`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (list.ok()) {
    const spaces = await list.json();
    const active = spaces.filter((s) => s.isActive === true || s.isActive === 1);
    if (active.length >= n) return;
  }
  const setRes = await apiCtx.put(`${baseURL}/api/admin/configuration/parking-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { parkingCount: n, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) {
    const body = await setRes.text();
    throw new Error(`parking-count update failed: ${setRes.status()} ${body}`);
  }
}

function uniqueFutureDate() {
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-10-${String(day).padStart(2, '0')}`;
}

test.describe('Multi-select parking reservation (Phase 25.6)', () => {
  let userSession;
  let reservationDate;

  test.beforeAll(async () => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const apiCtx = await request.newContext();
    try {
      const admin = await ensureAdmin(apiCtx, baseURL);
      await ensureAtLeastNParkingSpaces(apiCtx, baseURL, admin.token, REQUIRED_SPACE_COUNT);
      userSession = await ensureRegularUser(apiCtx, baseURL, admin.token);
      reservationDate = uniqueFutureDate();
    } finally {
      await apiCtx.dispose();
    }
  });

  test('select three parking spaces and Reserve Selected creates three reservations', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: userSession.user }
    );

    await page.goto('/pages/parking.html');

    await page.locator('#reservationDate').fill(reservationDate);
    await page.locator('#timePeriod').selectOption('full_day');
    await page.locator('#checkAvailabilityBtn').click();

    const spacesContainer = page.locator('#parking-spaces-container');
    await expect(spacesContainer).toBeVisible();
    const spaceCards = page.locator('.desk-card[data-space-id]');
    await expect(spaceCards.nth(REQUIRED_SPACE_COUNT - 1)).toBeVisible({ timeout: 10_000 });

    const selectedSpaceIds = [];
    for (let i = 0; i < REQUIRED_SPACE_COUNT; i++) {
      const card = spaceCards.nth(i);
      const id = await card.getAttribute('data-space-id');
      selectedSpaceIds.push(id);
      await card.locator('.select-space-btn').click();
      await expect(card).toHaveClass(/selected/);
      await expect(card.locator('.selection-indicator')).toBeVisible();
      await expect(card.locator('.book-space-btn')).toBeHidden();
    }

    const selectionCount = page.locator('#parking-selection-count');
    await expect(selectionCount).toHaveText(`${REQUIRED_SPACE_COUNT} spaces selected`);

    const reserveSelectedBtn = page.locator('#reserve-selected-btn');
    await expect(reserveSelectedBtn).toBeEnabled();

    await Promise.all([
      page.waitForURL(/\/pages\/bookings\.html$/, { timeout: 15_000 }),
      reserveSelectedBtn.click(),
    ]);

    const bookingsContainer = page.locator('#bookings-container');
    await expect(bookingsContainer).toBeVisible();

    // Verify the reservations landed via the same API the page calls.
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.get(`${process.env.E2E_BASE_URL || 'http://localhost:3000'}/api/parking-reservations/my-reservations`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
      });
      expect(res.ok()).toBeTruthy();
      const reservations = await res.json();
      const dateOf = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');
      const seededRows = reservations.filter(
        (r) =>
          dateOf(r.reservationDate) === reservationDate &&
          (r.status === 'active' || r.status === undefined) &&
          selectedSpaceIds.includes(String(r.spaceId || r.parkingSpaceId))
      );
      expect(seededRows.length).toBe(REQUIRED_SPACE_COUNT);
    } finally {
      await apiCtx.dispose();
    }
  });
});
