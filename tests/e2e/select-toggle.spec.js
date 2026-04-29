// Phase 28.10 — End-to-end: Select-as-toggle and uniform booking-card button sizing.
//
// Validates spec section 23 (refining section 19) on a real browser:
//   - Select and Book/Reserve render at the same bounding-box dimensions
//     on desk and parking cards (the underlying Phase 28 fix introduces a
//     shared .btn-card-action class and removes the legacy width:100% +
//     margin-top rule that had made Book noticeably shorter than Select).
//   - Click Select once: the card flips to selected, the Select label
//     becomes "Selected", aria-pressed is "true", and the per-card
//     Book/Reserve control on that same card is hidden.
//   - Click Select again: the card returns to unselected; aria-pressed is
//     "false"; the Book/Reserve control reappears.
//
// Mirrors the seeding pattern in multi-select-desk.spec.js so this test
// can run independently against a clean stack.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-select-toggle-user@test.com';
const USER_PASSWORD = 'Password123!';
const REQUIRED_DESK_COUNT = 3;
const REQUIRED_PARKING_COUNT = 3;

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
  throw new Error('No admin session available for e2e select-toggle test; start the stack with a clean DB.');
}

async function ensureRegularUser(apiCtx, baseURL, adminToken) {
  const existing = await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
  if (existing) return existing;

  const prov = await apiCtx.post(`${baseURL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: USER_EMAIL, name: 'E2E Select Toggle User' },
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

function uniqueFutureDate(offset = 0) {
  // Far-future date with per-run jitter so reruns don't collide.
  const day = ((Math.floor(Date.now() / 1000) + offset) % 27) + 1;
  return `2099-12-${String(day).padStart(2, '0')}`;
}

/**
 * Read the rendered bounding-box width and height of a single locator.
 * Used to assert the per-card Select and Book/Reserve buttons render at
 * identical dimensions (Phase 28 sizing parity).
 */
async function boxOf(locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('boundingBox() returned null; element not laid out');
  }
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

test.describe('Select-as-toggle and uniform card button sizing (Phase 28.10)', () => {
  let userSession;
  let deskDate;
  let parkingDate;

  test.beforeAll(async () => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const apiCtx = await request.newContext();
    try {
      const admin = await ensureAdmin(apiCtx, baseURL);
      await ensureAtLeastNDesks(apiCtx, baseURL, admin.token, REQUIRED_DESK_COUNT);
      await ensureAtLeastNParkingSpaces(apiCtx, baseURL, admin.token, REQUIRED_PARKING_COUNT);
      userSession = await ensureRegularUser(apiCtx, baseURL, admin.token);
      deskDate = uniqueFutureDate(0);
      parkingDate = uniqueFutureDate(13);
    } finally {
      await apiCtx.dispose();
    }
  });

  test('desk Select and Book buttons match in size; Select toggles and hides Book', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: userSession.user }
    );

    await page.goto('/pages/desk-booking.html');
    await page.locator('#startDate').fill(deskDate);
    await page.locator('#endDate').fill(deskDate);
    await page.locator('#checkAvailabilityBtn').click();

    const cards = page.locator('.desk-card[data-desk-id]');
    await expect(cards.nth(REQUIRED_DESK_COUNT - 1)).toBeVisible({ timeout: 10_000 });

    const card = cards.first();
    const selectBtn = card.locator('.select-desk-btn');
    const bookBtn = card.locator('.book-desk-btn');

    // Phase 28: shared .btn-card-action sizing class is in place on both
    // buttons and they render at identical bounding-box dimensions.
    await expect(selectBtn).toHaveClass(/btn-card-action/);
    await expect(bookBtn).toHaveClass(/btn-card-action/);
    const selectBox = await boxOf(selectBtn);
    const bookBox = await boxOf(bookBtn);
    expect(selectBox.width).toBe(bookBox.width);
    expect(selectBox.height).toBe(bookBox.height);

    // Phase 28: initial state — aria-pressed is "false", label "Select".
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(selectBtn).toHaveText('Select');

    // Click Select: card becomes selected, Book is hidden, aria-pressed
    // and label flip to the active state.
    await selectBtn.click();
    await expect(card).toHaveClass(/selected/);
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(selectBtn).toHaveText('Selected');
    await expect(bookBtn).toBeHidden();

    // Click Select again: deselect; Book restored; aria-pressed back to
    // "false" and label back to "Select".
    await selectBtn.click();
    await expect(card).not.toHaveClass(/selected/);
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(selectBtn).toHaveText('Select');
    await expect(bookBtn).toBeVisible();
  });

  test('parking Select and Reserve buttons match in size; Select toggles and hides Reserve', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: userSession.user }
    );

    await page.goto('/pages/parking.html');
    await page.locator('#reservationDate').fill(parkingDate);
    await page.locator('#timePeriod').selectOption('morning');
    await page.locator('#checkAvailabilityBtn').click();

    const cards = page.locator('.desk-card[data-space-id]');
    await expect(cards.nth(REQUIRED_PARKING_COUNT - 1)).toBeVisible({ timeout: 10_000 });

    const card = cards.first();
    const selectBtn = card.locator('.select-space-btn');
    const reserveBtn = card.locator('.book-space-btn');

    await expect(selectBtn).toHaveClass(/btn-card-action/);
    await expect(reserveBtn).toHaveClass(/btn-card-action/);
    const selectBox = await boxOf(selectBtn);
    const reserveBox = await boxOf(reserveBtn);
    expect(selectBox.width).toBe(reserveBox.width);
    expect(selectBox.height).toBe(reserveBox.height);

    await expect(selectBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(selectBtn).toHaveText('Select');

    await selectBtn.click();
    await expect(card).toHaveClass(/selected/);
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(selectBtn).toHaveText('Selected');
    await expect(reserveBtn).toBeHidden();

    await selectBtn.click();
    await expect(card).not.toHaveClass(/selected/);
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(selectBtn).toHaveText('Select');
    await expect(reserveBtn).toBeVisible();
  });
});
