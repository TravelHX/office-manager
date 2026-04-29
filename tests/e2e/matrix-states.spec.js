// Phase 31.10 — End-to-end: Booking Matrix lifecycle states.
//
// Validates the four mutually exclusive states `#matrix-region` cycles
// through (per spec section 26):
//   1. empty   — initial render before Load Matrix is pressed.
//   2. loading — request in flight (spinner visible).
//   3. loaded  — successful response (matrix grid replaces the spinner).
//   4. error   — failed response (error block + Retry button).
//
// The test forces an error path by intercepting the matrix API and
// returning a 500. After observing the error block, it clicks Retry, the
// route handler removes its abort, and the next request succeeds —
// confirming Retry re-fires the same request.
//
// Mirrors the seed pattern from booking-matrix.spec.js / multi-select-desk
// .spec.js so this test runs independently against a clean stack.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'e2e-audit-admin@test.com';
const ADMIN_PASSWORD = 'Password123!';

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
            data: {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                first_name: 'E2E',
                last_name: 'Admin',
                office_location: 'London',
            },
        });
        if (!reg.ok()) {
            throw new Error(`register admin failed: ${reg.status()}`);
        }
        return await reg.json();
    }
    throw new Error('No admin session available for matrix-states e2e test; start the stack with a clean DB.');
}

function farFutureRange() {
    // Far-future dates so we don't collide with seeded fixtures and we can
    // pre-populate the inputs deterministically.
    return { start: '2099-11-01', end: '2099-11-07' };
}

test.describe('Phase 31: Booking Matrix lifecycle states', () => {
    let adminSession;

    test.beforeAll(async () => {
        const apiCtx = await request.newContext();
        try {
            adminSession = await ensureAdmin(apiCtx);
        } finally {
            await apiCtx.dispose();
        }
    });

    test('initial render shows the filter card and the empty state', async ({ page }) => {
        await page.addInitScript(
            ({ token, u }) => {
                window.localStorage.setItem('authToken', token);
                window.localStorage.setItem('user', JSON.stringify(u));
            },
            { token: adminSession.token, u: adminSession.user }
        );

        await page.goto('/pages/matrix.html');

        // Filter card is the bordered group around the .form-row.
        await expect(page.locator('.matrix-filter-card')).toBeVisible();
        await expect(page.locator('.matrix-filter-card .form-row')).toBeVisible();

        // Empty state is the initial child of #matrix-region.
        const region = page.locator('#matrix-region');
        await expect(region).toHaveAttribute('data-state', 'empty');
        await expect(region.locator('.matrix-empty-state')).toBeVisible();
        await expect(region.locator('.matrix-state-title')).toHaveText(/Select a date range/i);
    });

    test('Load Matrix transitions empty -> loading -> loaded', async ({ page }) => {
        await page.addInitScript(
            ({ token, u }) => {
                window.localStorage.setItem('authToken', token);
                window.localStorage.setItem('user', JSON.stringify(u));
            },
            { token: adminSession.token, u: adminSession.user }
        );

        // Slow the matrix endpoint so we can observe the loading state in
        // the browser before it resolves.
        await page.route('**/api/matrix/bookings*', async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 400));
            await route.continue();
        });

        await page.goto('/pages/matrix.html');

        const range = farFutureRange();
        await page.locator('#startDate').fill(range.start);
        await page.locator('#endDate').fill(range.end);

        const loadPromise = page.locator('#loadMatrixBtn').click();

        // While the in-flight delay is running, the loading state is shown.
        const region = page.locator('#matrix-region');
        await expect(region).toHaveAttribute('data-state', 'loading');
        await expect(region.locator('.matrix-spinner')).toBeVisible();

        await loadPromise;

        // After the response settles, the loaded state is in place. The
        // matrix-container is the slot renderMatrix populates; for an empty
        // result set it shows a "No data available" fallback, which still
        // counts as the loaded state.
        await expect(region).toHaveAttribute('data-state', 'loaded');
        await expect(region.locator('#matrix-container')).toBeVisible();
    });

    test('matrix API failure shows the error state with a working Retry button', async ({ page }) => {
        await page.addInitScript(
            ({ token, u }) => {
                window.localStorage.setItem('authToken', token);
                window.localStorage.setItem('user', JSON.stringify(u));
            },
            { token: adminSession.token, u: adminSession.user }
        );

        // First request: force a 500. Second request (after Retry): pass
        // through to the real backend so the matrix loads successfully.
        let callCount = 0;
        await page.route('**/api/matrix/bookings*', async (route) => {
            callCount += 1;
            if (callCount === 1) {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: { message: 'forced failure', code: 'TEST_FAIL' } }),
                });
                return;
            }
            await route.continue();
        });

        await page.goto('/pages/matrix.html');

        const range = farFutureRange();
        await page.locator('#startDate').fill(range.start);
        await page.locator('#endDate').fill(range.end);
        await page.locator('#loadMatrixBtn').click();

        // First response is the 500 → the error state appears.
        const region = page.locator('#matrix-region');
        await expect(region).toHaveAttribute('data-state', 'error');
        await expect(region.locator('.matrix-error-state')).toBeVisible();
        await expect(region.locator('.matrix-error-message')).toContainText('forced failure');

        const retryBtn = page.locator('#matrix-retry-btn');
        await expect(retryBtn).toBeVisible();
        await retryBtn.click();

        // Second response is real → loaded state replaces the error block.
        await expect(region).toHaveAttribute('data-state', 'loaded');
        expect(callCount).toBe(2);
    });
});
