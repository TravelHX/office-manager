// Phase 21.17 — End-to-end: admin opens the Audit tab, searches, and sees a
// seeded event.
//
// Flow validated:
//   1. Ensure an admin session exists (idempotent: login as the seed user; if
//      no users exist, register — which makes the first user admin).
//   2. Seed a specific, unique audit event by provisioning a new user via the
//      admin API. Provisioning emits USER_CREATED with a payload containing
//      the new user's email.
//   3. Open the admin page with the admin token pre-seeded in localStorage
//      so the Audit tab button is revealed.
//   4. Click the Audit tab, confirm rows render.
//   5. Search for the unique email; confirm the filtered result is visible
//      and the unique email is shown in the table.
//
// The test has no webServer config: the app stack must already be running on
// BASE_URL (docker-compose up -d, port 3000).

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';

async function loginAsOrNull(apiCtx, baseURL, email, password) {
  const res = await apiCtx.post(`${baseURL}/api/auth/login`, {
    data: { username: email, password },
  });
  if (!res.ok()) return null;
  const body = await res.json();
  return body;
}

async function ensureAdminSession(apiCtx, baseURL) {
  // 1) Try login as the dedicated e2e admin seed.
  const existing = await loginAsOrNull(apiCtx, baseURL, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (existing && existing.user && (existing.user.isAdmin || existing.user.role === 'admin')) {
    return existing;
  }

  // 2) If no users exist at all, register — the first user becomes admin.
  const check = await apiCtx.get(`${baseURL}/api/auth/check-users`);
  if (!check.ok()) {
    throw new Error(`check-users returned HTTP ${check.status()}`);
  }
  const { hasUsers } = await check.json();
  if (!hasUsers) {
    const reg = await apiCtx.post(`${baseURL}/api/auth/register`, {
      data: {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        first_name: 'E2E',
        last_name: 'Admin',
        office_location: 'London',
      },
    });
    if (!reg.ok()) {
      const body = await reg.text();
      throw new Error(`register failed: HTTP ${reg.status()} ${body}`);
    }
    return await reg.json();
  }

  // 3) Users exist but we can't get an admin session. Try logging in with
  // Phase 22.1's seed user (release-history setup) in case that's the admin.
  const fallback = await loginAsOrNull(apiCtx, baseURL, 'e2e-release-history-seed@test.com', 'Password123!');
  if (fallback && fallback.user && (fallback.user.isAdmin || fallback.user.role === 'admin')) {
    return fallback;
  }

  throw new Error(
    'No admin session available for e2e test. Flush users or start the stack clean so the first registered user becomes admin.'
  );
}

test.describe('Admin audit tab (Phase 21.17)', () => {
  let adminToken;
  let adminUser;
  let seededEmail;

  test.beforeAll(async () => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const apiCtx = await request.newContext();
    try {
      const session = await ensureAdminSession(apiCtx, baseURL);
      adminToken = session.token;
      adminUser = session.user;

      // Seed a specific, searchable audit row by provisioning a new user.
      // The email contains a unique timestamp so that even on a dirty stack
      // the search below matches exactly one row.
      seededEmail = `e2e-audit-seed-${Date.now()}@test.com`;
      const prov = await apiCtx.post(`${baseURL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { email: seededEmail, name: 'Audit Seed Target' },
      });
      if (!prov.ok()) {
        const body = await prov.text();
        throw new Error(`seed provisioning failed: HTTP ${prov.status()} ${body}`);
      }
    } finally {
      await apiCtx.dispose();
    }
  });

  test('admin opens Audit tab, searches, sees the seeded USER_CREATED event', async ({ page }) => {
    // Inject the admin session into localStorage so main.js picks it up on
    // page load. Navigate somewhere harmless first because addInitScript only
    // fires on subsequent page.goto calls — actually addInitScript fires for
    // every navigation including the first, so this is fine.
    const sessionUser = { ...adminUser, isAdmin: true, role: adminUser.role || 'admin' };
    await page.addInitScript(
      ({ token, user }) => {
        try {
          window.localStorage.setItem('authToken', token);
          window.localStorage.setItem('user', JSON.stringify(user));
        } catch (_err) {
          // jsdom/headless should support localStorage; ignore otherwise.
        }
      },
      { token: adminToken, user: sessionUser }
    );

    await page.goto('/pages/admin.html');

    // The Audit tab button is hidden by default and revealed only after the
    // admin check in admin.js completes. Wait for that to finish.
    const auditTabBtn = page.locator('#audit-tab-btn');
    await expect(auditTabBtn).toBeVisible({ timeout: 10_000 });

    await auditTabBtn.click();

    // Loading state replaced with either the table or a No events message.
    const container = page.locator('#audit-events-container');
    await expect(container).toBeVisible();
    await expect(container).not.toHaveText(/Loading audit events/i, { timeout: 10_000 });

    // Table should be present and contain at least one row.
    await expect(container.locator('table.audit-events-table')).toBeVisible();

    // Search for the unique seeded email and confirm exactly that row renders.
    const searchInput = page.locator('#audit-search-input');
    await searchInput.fill(seededEmail);
    await page.locator('#audit-search-btn').click();

    await expect(container).not.toHaveText(/Loading audit events/i, { timeout: 10_000 });
    // One of the rows should contain the seeded email (in the payload column).
    await expect(container).toContainText(seededEmail);
    // And the action should be USER_CREATED.
    await expect(container).toContainText('USER_CREATED');
  });
});
