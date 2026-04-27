// Phase 23e end-to-end: admin uploads a floor plan and places a desk; a
// regular user signs in, opens Desk Booking, and sees the floor plan
// image rendered with their seeded desk as a clickable marker.
//
// The 23.15 task in todo.md asks for an admin upload + landmark + user
// sees-map flow plus the desk-cancel-undo flow. The undo path is
// already covered by tests/e2e/undo-cancel.spec.js (Phase 23c). This
// file covers the map portion.

const path = require('path');
const fs = require('fs');
const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-undo-user@test.com';
const USER_PASSWORD = 'Password123!';

// Tiny valid PNG (1×1 transparent) — same bytes as the integration test.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64'
);

async function loginAsOrNull(api, baseURL, email, password) {
  const res = await api.post(`${baseURL}/api/auth/login`, { data: { username: email, password } });
  if (!res.ok()) return null;
  return await res.json();
}

async function ensureAdmin(api, baseURL) {
  const existing = await loginAsOrNull(api, baseURL, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (existing && (existing.user.isAdmin || existing.user.role === 'admin')) return existing;
  const check = await api.get(`${baseURL}/api/auth/check-users`);
  const { hasUsers } = await check.json();
  if (!hasUsers) {
    const reg = await api.post(`${baseURL}/api/auth/register`, {
      data: {
        email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
        first_name: 'E2E', last_name: 'Admin', office_location: 'London',
      },
    });
    if (!reg.ok()) throw new Error(`register admin failed: ${reg.status()}`);
    return await reg.json();
  }
  throw new Error('No admin session available; start the stack with a clean DB.');
}

async function ensureRegularUser(api, baseURL, adminToken) {
  const existing = await loginAsOrNull(api, baseURL, USER_EMAIL, USER_PASSWORD);
  if (existing) return existing;
  const prov = await api.post(`${baseURL}/api/auth/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: USER_EMAIL, name: 'E2E Maps User' },
  });
  if (!prov.ok()) throw new Error(`provision user failed: ${prov.status()}`);
  const body = await prov.json();
  await api.post(`${baseURL}/api/auth/complete-profile`, {
    data: { token: body.invitationToken, password: USER_PASSWORD, office_location: 'London' },
  });
  return await loginAsOrNull(api, baseURL, USER_EMAIL, USER_PASSWORD);
}

async function ensureDeskId(api, baseURL, adminToken) {
  const res = await api.get(`${baseURL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (res.ok()) {
    const desks = await res.json();
    const active = desks.find((d) => d.isActive === true || d.isActive === 1);
    if (active) return active.id;
  }
  await api.put(`${baseURL}/api/admin/configuration/desk-count`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { deskCount: 1, numberingMode: 'auto', startNumber: 1 },
  });
  const again = await api.get(`${baseURL}/api/admin/desks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const desks = await again.json();
  return desks[0].id;
}

test.describe('Floor plan map (Phase 23e / task 23.15)', () => {
  let adminToken;
  let userSession;
  let deskId;
  let baseURL;

  test.beforeAll(async () => {
    baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const api = await request.newContext();
    try {
      const admin = await ensureAdmin(api, baseURL);
      adminToken = admin.token;
      userSession = await ensureRegularUser(api, baseURL, adminToken);
      deskId = await ensureDeskId(api, baseURL, adminToken);

      // Seed the floor plan + a landmark + the desk's coordinates via API
      // so the test focuses on the user-side rendering rather than driving
      // the admin editor (which is exercised separately in the test below).
      const upload = await api.post(`${baseURL}/api/admin/maps/desk/floor-plan`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'image/png',
        },
        data: TINY_PNG,
      });
      if (!upload.ok()) throw new Error(`floor plan upload failed: ${upload.status()}`);

      await api.post(`${baseURL}/api/admin/maps/desk/landmarks`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { type: 'lift', label: 'E2E Lift', x: 0.5, y: 0.5 },
      });

      await api.put(`${baseURL}/api/admin/maps/desk/resources/${deskId}/coordinates`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { x: 0.25, y: 0.75 },
      });
    } finally {
      await api.dispose();
    }
  });

  test('regular user opens Desk Booking and sees the floor plan with desk marker', async ({ page }) => {
    const sessionUser = { ...userSession.user };
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: sessionUser }
    );

    await page.goto('/pages/desk-booking.html');

    // Map panel is visible with the floor plan loaded (no fallback shown).
    const panel = page.locator('#desk-map-container');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.locator('.map-viewport')).toBeVisible({ timeout: 10_000 });
    await expect(panel.locator('img.map-floor-plan')).toBeVisible();

    // Lift landmark is rendered (orientation only, not clickable).
    await expect(panel.locator('.map-landmark')).toContainText(/Lift|E2E Lift/);

    // Pick dates in the far future and check availability so the desk is in
    // the available list and the marker is rendered for that desk id.
    await page.locator('#startDate').fill('2099-09-01');
    await page.locator('#endDate').fill('2099-09-01');
    await page.locator('#checkAvailabilityBtn').click();

    const marker = panel.locator(`.map-resource-marker[data-resource-id="${deskId}"]`);
    await expect(marker).toBeVisible({ timeout: 10_000 });

    // Clicking the marker toggles the desk's selection in the list panel.
    await marker.click();
    const card = page.locator(`.desk-card[data-desk-id="${deskId}"]`);
    await expect(card).toHaveClass(/selected/, { timeout: 5_000 });
  });

  test('admin sees the Maps tab and can switch contexts in the editor', async ({ page }) => {
    const sessionUser = { /* loaded fresh from API to keep admin role current */ };
    const api = await request.newContext();
    let admin;
    try {
      admin = await loginAsOrNull(api, baseURL, ADMIN_EMAIL, ADMIN_PASSWORD);
    } finally {
      await api.dispose();
    }
    expect(admin).not.toBeNull();

    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: admin.token, u: { ...admin.user, isAdmin: true, role: admin.user.role || 'admin' } }
    );

    await page.goto('/pages/admin.html');

    const mapsTabBtn = page.locator('#maps-tab-btn');
    await expect(mapsTabBtn).toBeVisible({ timeout: 10_000 });
    await mapsTabBtn.click();

    const editorCanvas = page.locator('#map-editor-canvas');
    await expect(editorCanvas).toBeVisible({ timeout: 10_000 });
    // Floor plan is already uploaded by beforeAll, so the desk-context
    // editor renders with a viewport.
    await expect(editorCanvas.locator('.map-viewport')).toBeVisible({ timeout: 10_000 });

    // Switching context should re-fetch (parking-context floor plan may
    // not exist; renderer shows the empty hint, which is also fine).
    await page.locator('#map-context').selectOption('parking');
    // Either the parking floor plan loads, or the empty hint is shown.
    await expect(editorCanvas.locator('.map-viewport, .map-empty')).toBeVisible({ timeout: 10_000 });
  });
});
