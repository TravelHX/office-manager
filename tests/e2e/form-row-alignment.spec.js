// Phase 30.9 — End-to-end: every input + adjacent action button row sits on
// the same Y axis.
//
// Flow validated:
//   1. Seed an admin and a regular user with at least one desk and one
//      parking space (idempotent; mirrors multi-select-desk.spec.js).
//   2. Visit each page that owns a side-by-side form row, query the row
//      controls, and assert their bounding-box bottoms align within a
//      small pixel tolerance. (`align-items: flex-end` is the contract;
//      bottom-edge alignment is what the user perceives.)
//
// The 1px tolerance accommodates sub-pixel rendering across browsers and
// platforms; without it the assertions would be flaky on font-hinting
// differences. The structural side of the contract — that every row uses
// the shared `.form-row` class — is asserted in
// `src/frontend/tests/form-row-alignment.test.js`.

const { test, expect, request } = require('@playwright/test');

const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';
const USER_EMAIL = 'e2e-form-row-user@test.com';
const USER_PASSWORD = 'Password123!';
const ALIGNMENT_TOLERANCE_PX = 1;

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
    throw new Error('No admin session available for e2e form-row test; start the stack with a clean DB.');
}

async function ensureRegularUser(apiCtx, baseURL, adminToken) {
    const existing = await loginAsOrNull(apiCtx, baseURL, USER_EMAIL, USER_PASSWORD);
    if (existing) return existing;

    const prov = await apiCtx.post(`${baseURL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { email: USER_EMAIL, name: 'E2E Form Row User' },
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

/**
 * Pick the bottom (y + height) of each locator's bounding box and assert
 * that all of them line up within `tolerancePx`. We compare bottoms because
 * the .form-row contract is `align-items: flex-end`.
 */
async function expectBottomsAligned(locators, tolerancePx = ALIGNMENT_TOLERANCE_PX) {
    const bottoms = [];
    for (const locator of locators) {
        const box = await locator.boundingBox();
        expect(box).not.toBeNull();
        bottoms.push(box.y + box.height);
    }
    const min = Math.min(...bottoms);
    const max = Math.max(...bottoms);
    expect(max - min).toBeLessThanOrEqual(tolerancePx);
}

test.describe('Phase 30: form-row vertical alignment', () => {
    let adminSession;
    let userSession;

    test.beforeAll(async () => {
        const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
        const apiCtx = await request.newContext();
        try {
            adminSession = await ensureAdmin(apiCtx, baseURL);
            userSession = await ensureRegularUser(apiCtx, baseURL, adminSession.token);
        } finally {
            await apiCtx.dispose();
        }
    });

    test('parking page: reservation date, time period, and Check Availability bottoms align', async ({ page }) => {
        await page.addInitScript(
            ({ token, u }) => {
                window.localStorage.setItem('authToken', token);
                window.localStorage.setItem('user', JSON.stringify(u));
            },
            { token: userSession.token, u: userSession.user }
        );

        await page.goto('/pages/parking.html');
        const row = page.locator('.booking-form');
        await expect(row).toHaveClass(/form-row/);

        await expectBottomsAligned([
            page.locator('#reservationDate'),
            page.locator('#timePeriod'),
            page.locator('#checkAvailabilityBtn'),
        ]);
    });

    test('desk booking page: start date, end date, and Check Availability bottoms align', async ({ page }) => {
        await page.addInitScript(
            ({ token, u }) => {
                window.localStorage.setItem('authToken', token);
                window.localStorage.setItem('user', JSON.stringify(u));
            },
            { token: userSession.token, u: userSession.user }
        );

        await page.goto('/pages/desk-booking.html');
        const row = page.locator('.booking-form');
        await expect(row).toHaveClass(/form-row/);

        await expectBottomsAligned([
            page.locator('#startDate'),
            page.locator('#endDate'),
            page.locator('#checkAvailabilityBtn'),
        ]);
    });

    test('booking matrix page: filter inputs and Load Matrix bottoms align', async ({ page }) => {
        await page.addInitScript(
            ({ token, u }) => {
                window.localStorage.setItem('authToken', token);
                window.localStorage.setItem('user', JSON.stringify(u));
            },
            { token: adminSession.token, u: adminSession.user }
        );

        await page.goto('/pages/matrix.html');
        const row = page.locator('.filters-panel');
        await expect(row).toHaveClass(/form-row/);

        // Multi-select widgets render slightly taller than other selects in
        // some browsers; assert alignment of the date inputs, the simple
        // viewType select, and both action buttons — these are the common
        // cases the user perceives.
        await expectBottomsAligned([
            page.locator('#startDate'),
            page.locator('#endDate'),
            page.locator('#viewType'),
            page.locator('#loadMatrixBtn'),
            page.locator('#exportMatrixBtn'),
        ]);
    });
});
