// Phase 25.9 — End-to-end: employee attempts to book when no desks are available.
//
// Implements `docs/usecases.md` Use Case 3. The test seeds enough state via
// API so the desk-booking UI ends up in the "no desks available" branch:
//
//   1. Ensure at least one active desk exists (admin-side seeding).
//   2. As a "blocker" user, book every active desk for a unique future
//      date via /api/bookings (one per desk; user can hold one booking
//      per overlapping date — but since each desk goes to a separate
//      blocker is unnecessary, we cycle through several blocker users…
//      actually a single blocker can only hold ONE desk for a date, so
//      we use one blocker per desk).
//   3. Log in as a "viewer" user in the browser, open desk-booking, fill
//      the same date in both ends of the range, and click Check
//      Availability.
//   4. Confirm the page renders the "No desks available" error message
//      (text comes from the desk-booking page when availableDesks is
//      empty) and that no .desk-card is rendered.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const VIEWER_EMAIL = 'e2e-no-desks-viewer@test.com';
const VIEWER_PASSWORD = 'Password123!';
const BLOCKER_EMAIL_PREFIX = 'e2e-no-desks-blocker';
const BLOCKER_PASSWORD = 'Password123!';

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

async function getActiveDeskIds(apiCtx, adminToken) {
  const res = await apiCtx.get(`${BASE_URL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok()) throw new Error(`list desks failed: ${res.status()}`);
  const desks = await res.json();
  return desks.filter((d) => d.isActive === true || d.isActive === 1).map((d) => d.id);
}

async function ensureAtLeastOneDesk(apiCtx, adminToken) {
  const ids = await getActiveDeskIds(apiCtx, adminToken);
  if (ids.length >= 1) return;
  const setRes = await apiCtx.put(`${BASE_URL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: 1, numberingMode: 'auto', startNumber: 1 },
  });
  if (!setRes.ok()) throw new Error(`desk-count update failed: ${setRes.status()}`);
}

function uniqueFutureDate() {
  // Use a separate month from the other multi-select / mixed specs to keep
  // each test's bookings on its own days.
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-06-${String(day).padStart(2, '0')}`;
}

test.describe('No desks available (Phase 25.9, Use Case 3)', () => {
  let viewerSession;
  let bookingDate;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      const admin = await ensureAdmin(apiCtx);
      await ensureAtLeastOneDesk(apiCtx, admin.token);
      const deskIds = await getActiveDeskIds(apiCtx, admin.token);
      bookingDate = uniqueFutureDate();

      // Each blocker holds ONE desk for the date. We use one blocker per
      // desk because BookingService disallows a single user from holding
      // multiple desk bookings on overlapping dates.
      for (let i = 0; i < deskIds.length; i++) {
        const blockerEmail = `${BLOCKER_EMAIL_PREFIX}-${i}@test.com`;
        const blockerSession = await ensureProvisionedUser(
          apiCtx,
          admin.token,
          blockerEmail,
          BLOCKER_PASSWORD,
          `E2E Blocker ${i}`
        );
        // The blocker may already hold this desk for this date from a
        // previous run; the booking endpoint will respond 409 / 400 in
        // that case, which is fine — the precondition is satisfied
        // either way. We swallow non-2xx responses unless they indicate
        // a structural problem.
        const book = await apiCtx.post(`${BASE_URL}/api/bookings`, {
          headers: { Authorization: `Bearer ${blockerSession.token}` },
          data: { deskId: deskIds[i], startDate: bookingDate, endDate: bookingDate },
        });
        if (!book.ok() && book.status() !== 409 && book.status() !== 400) {
          const body = await book.text();
          throw new Error(`blocker ${i} could not book desk ${deskIds[i]}: ${book.status()} ${body}`);
        }
      }

      viewerSession = await ensureProvisionedUser(
        apiCtx,
        admin.token,
        VIEWER_EMAIL,
        VIEWER_PASSWORD,
        'E2E No-Desks Viewer'
      );
    } finally {
      await apiCtx.dispose();
    }
  });

  test('viewer sees the No desks available message when every desk is taken', async ({ page }) => {
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: viewerSession.token, u: viewerSession.user }
    );

    await page.goto('/pages/desk-booking.html');
    await page.locator('#startDate').fill(bookingDate);
    await page.locator('#endDate').fill(bookingDate);
    await page.locator('#checkAvailabilityBtn').click();

    // The error message lives in #availability-message; the UI clears
    // #desks-container when no desks are available.
    const message = page.locator('#availability-message');
    await expect(message).toContainText(/No desks available/i, { timeout: 10_000 });

    const deskCards = page.locator('.desk-card[data-desk-id]');
    await expect(deskCards).toHaveCount(0);
  });
});
