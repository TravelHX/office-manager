// Phase 32.12 — End-to-end: admin uploads an SVG floor plan, the desk
// booking page renders it, an embedded <script> in the source SVG does
// NOT execute (browser sandboxes SVG embedded as <img>), and a placed
// landmark + desk marker remain visible at their normalised coordinates.
//
// The test mirrors tests/e2e/maps.spec.js (Phase 23e) but swaps the PNG
// payload for an SVG that contains a <script> tag and an onload handler.
// The server-side sanitiser (src/backend/utils/svg-sanitizer.js) strips
// active content before storage, and the renderer embeds the result via
// <img>, so even if a future regression bypassed the sanitiser the
// browser would still refuse to execute embedded scripts.
//
// We assert the script did not execute by reading window.__pwn_svg_e2e on
// the desk booking page; the sentinel is set by `addInitScript` to
// `false` before navigation, and would only flip to `true` if the SVG
// were inlined and active.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-maps-svg-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-maps-svg-user@test.com';
const USER_PASSWORD = 'Password123!';

// SVG carrying both a <script> block and an onload attribute. The
// sanitiser must strip both before storage.
const HOSTILE_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"
        onload="window.__pwn_svg_e2e = true">
    <script>window.__pwn_svg_e2e = true;</script>
    <rect width="10" height="10"/>
  </svg>`,
  'utf8'
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
        first_name: 'E2E', last_name: 'SvgAdmin', office_location: 'London',
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
    data: { email: USER_EMAIL, name: 'E2E SVG User' },
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

test.describe('SVG floor plan upload (Phase 32.12)', () => {
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

      // Upload the hostile SVG. The server-side sanitiser strips
      // <script> and onload before storage, so the bytes the renderer
      // ultimately fetches are inert.
      const upload = await api.post(`${baseURL}/api/admin/maps/desk/floor-plan`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'image/svg+xml',
        },
        data: HOSTILE_SVG,
      });
      if (!upload.ok()) {
        throw new Error(`SVG floor plan upload failed: ${upload.status()} ${await upload.text()}`);
      }

      await api.post(`${baseURL}/api/admin/maps/desk/landmarks`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { type: 'lift', label: 'SVG Lift', x: 0.4, y: 0.6 },
      });

      await api.put(`${baseURL}/api/admin/maps/desk/resources/${deskId}/coordinates`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { x: 0.3, y: 0.7 },
      });
    } finally {
      await api.dispose();
    }
  });

  test('user sees SVG floor plan rendered as <img>, with markers visible and no script execution', async ({ page }) => {
    const sessionUser = { ...userSession.user };

    // Sentinel that the hostile SVG would set if it were inlined and active.
    await page.addInitScript(() => {
      window.__pwn_svg_e2e = false;
    });
    await page.addInitScript(
      ({ token, u }) => {
        window.localStorage.setItem('authToken', token);
        window.localStorage.setItem('user', JSON.stringify(u));
      },
      { token: userSession.token, u: sessionUser }
    );

    await page.goto('/pages/desk-booking.html');

    const panel = page.locator('#desk-map-container');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.locator('.map-viewport')).toBeVisible({ timeout: 10_000 });

    // Floor plan is embedded as <img>, so SVG-internal <script> cannot fire.
    const img = panel.locator('img.map-floor-plan');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('src', /\/api\/maps\/desk\/floor-plan\/image/);
    // Confirm the renderer has NOT inlined the SVG markup into the DOM.
    const inlinedSvg = await panel.locator('svg').count();
    expect(inlinedSvg).toBe(0);

    // The hostile script must not have executed.
    const pwn = await page.evaluate(() => window.__pwn_svg_e2e === true);
    expect(pwn).toBe(false);

    // Landmark is rendered on top of the floor plan image.
    await expect(panel.locator('.map-landmark')).toContainText(/Lift|SVG Lift/);

    // Pick a future date so the desk is available, then confirm the
    // resource marker overlays the SVG floor plan.
    await page.locator('#startDate').fill('2099-09-01');
    await page.locator('#endDate').fill('2099-09-01');
    await page.locator('#checkAvailabilityBtn').click();

    const marker = panel.locator(`.map-resource-marker[data-resource-id="${deskId}"]`);
    await expect(marker).toBeVisible({ timeout: 10_000 });
  });

  test('the bytes served for the SVG floor plan contain no <script> or onload (sanitiser ran)', async ({ request: rq }) => {
    // Hit the public floor-plan endpoint with the user's bearer token and
    // confirm the response body is sanitised. We cannot poll the file
    // system from Playwright, so we exercise the same path the renderer
    // does and inspect the bytes the browser would receive.
    const sessionUser = userSession;
    const res = await rq.get(`${baseURL}/api/maps/desk/floor-plan/image`, {
      headers: { Authorization: `Bearer ${sessionUser.token}` },
    });
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain('image/svg+xml');
    const body = await res.text();
    expect(body).not.toMatch(/<script/i);
    expect(body).not.toMatch(/onload\s*=/i);
    expect(body).toMatch(/<svg/i);
    expect(body).toMatch(/<rect/i);
  });
});
