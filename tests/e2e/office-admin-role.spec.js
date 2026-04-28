// Phase 26.14 — End-to-end: Office Administrator role.
//
// Implements the use cases added in Phase 26 (docs/usecases.md):
//   - Administrator promotes a regular User to Office Administrator via the
//     role endpoint.
//   - The promoted user logs in, sees the slimmed admin sidebar (no
//     Resource Configuration, no User Management, no Audit, no Maps).
//   - The Office Administrator cancels another user's desk booking from
//     the All Bookings tab (DELETE /api/admin/bookings/:id widened to
//     office_admin in Phase 26a).
//   - The Office Administrator is denied (403) on User Management API
//     endpoints — direct API probe asserts this.
//
// The test has no webServer config: the app stack must already be running
// on E2E_BASE_URL (default http://localhost:3000).

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const OA_EMAIL = 'e2e-office-admin-target@test.com';
const OA_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-office-admin-victim@test.com';
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
  // Use 2099 to avoid collisions with the rest of the suite which also
  // books in 2099. Spread across the month so concurrent runs are unlikely
  // to clash.
  const day = (Math.floor(Date.now() / 1000) % 27) + 1;
  return `2099-07-${String(day).padStart(2, '0')}`;
}

test.describe('Office Administrator role end-to-end (Phase 26.14)', () => {
  let adminSession;
  let oaSession;
  let userSession;
  let deskId;
  let bookingId;
  let bookingDate;

  test.beforeAll(async () => {
    const apiCtx = await request.newContext();
    try {
      adminSession = await ensureAdmin(apiCtx);

      deskId = await ensureAtLeastOneDesk(apiCtx, adminSession.token);

      // Provision both the would-be Office Administrator and the regular
      // user whose booking the OA will cancel.
      oaSession = await ensureProvisionedUser(
        apiCtx,
        adminSession.token,
        OA_EMAIL,
        OA_PASSWORD,
        'E2E Office Admin'
      );
      userSession = await ensureProvisionedUser(
        apiCtx,
        adminSession.token,
        USER_EMAIL,
        USER_PASSWORD,
        'E2E OA Victim'
      );

      // Promote the OA target via the new Phase 26 endpoint. This is the
      // single behaviour the test is asserting at the API layer too: an
      // Administrator can change a user's role to office_admin.
      const promote = await apiCtx.put(
        `${BASE_URL}/api/auth/users/${oaSession.user.id}/role`,
        {
          headers: { Authorization: `Bearer ${adminSession.token}` },
          data: { role: 'office_admin' },
        }
      );
      if (!promote.ok()) {
        const body = await promote.text();
        throw new Error(`promote to office_admin failed: ${promote.status()} ${body}`);
      }
      const promoted = await promote.json();
      expect(promoted.role).toBe('office_admin');

      // Re-login the OA so the JWT carries role=office_admin.
      oaSession = await loginAsOrNull(apiCtx, OA_EMAIL, OA_PASSWORD);
      expect(oaSession.user.role).toBe('office_admin');

      // Seed a desk booking owned by the regular user so the OA can cancel
      // it on their behalf.
      bookingDate = uniqueFutureDate();
      const book = await apiCtx.post(`${BASE_URL}/api/bookings`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
        data: { deskId, startDate: bookingDate, endDate: bookingDate },
      });
      if (!book.ok()) {
        const body = await book.text();
        throw new Error(`seed booking failed: ${book.status()} ${body}`);
      }
      bookingId = (await book.json()).id;
    } finally {
      await apiCtx.dispose();
    }
  });

  test('OA sees slimmed sidebar, cancels another user\'s booking, and is blocked from User Management', async ({ page }) => {
    // Inject the OA's session so admin.js detects role=office_admin on
    // first paint and applies the slimmed sidebar variant.
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: oaSession.token, u: oaSession.user }
    );

    // The admin cancellation flow uses window.prompt() for an optional
    // reason. Auto-accept with a fixed string.
    page.on('dialog', (dialog) => dialog.accept('E2E OA cancel'));

    await page.goto('/pages/admin.html');

    // The OA-only sidebar must hide Resource Configuration, Desks,
    // Parking Spaces, Booking Matrix, User Management, Audit, and Maps.
    // We assert visibility (not just style.display) so any future CSS
    // tweak still has to keep them out of view.
    const hiddenTabs = ['configuration', 'desks', 'parking-spaces', 'matrix'];
    for (const name of hiddenTabs) {
      await expect(page.locator(`.tab-btn[data-tab="${name}"]`)).toBeHidden();
    }
    await expect(page.locator('#users-tab-btn')).toBeHidden();
    await expect(page.locator('#audit-tab-btn')).toBeHidden();
    await expect(page.locator('#maps-tab-btn')).toBeHidden();

    // All Bookings should be the active tab on first paint for OAs.
    await expect(page.locator('.tab-btn[data-tab="bookings"]')).toBeVisible();
    await expect(page.locator('#bookings-tab')).toHaveClass(/active/);

    const cancelBtn = page.locator(`.admin-cancel-booking-btn[data-booking-id="${bookingId}"]`);
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    const successToast = page.locator('#notification-container .notification.success');
    await expect(successToast).toContainText(/cancelled successfully/i, { timeout: 10_000 });

    // Authoritative API check: the booking is now cancelled.
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.get(`${BASE_URL}/api/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${userSession.token}` },
      });
      expect(res.ok()).toBeTruthy();
      const bookings = await res.json();
      const seeded = bookings.find((b) => b.id === bookingId);
      expect(seeded).toBeDefined();
      expect(seeded.status).toBe('cancelled');

      // OA must NOT have access to User Management at the API layer.
      const userListRes = await apiCtx.get(`${BASE_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${oaSession.token}` },
      });
      expect(userListRes.status()).toBe(403);

      // Same for the role-assignment endpoint — even an OA who already
      // exists cannot change another user's role.
      const roleRes = await apiCtx.put(
        `${BASE_URL}/api/auth/users/${userSession.user.id}/role`,
        {
          headers: { Authorization: `Bearer ${oaSession.token}` },
          data: { role: 'office_admin' },
        }
      );
      expect(roleRes.status()).toBe(403);
    } finally {
      await apiCtx.dispose();
    }
  });
});
