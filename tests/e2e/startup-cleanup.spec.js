// Phase 25.4 — End-to-end: application startup cleanup.
//
// Implements the deferred Playwright task from Phase 14. The full startup
// cleanup flow lives in `UserService.performStartupCleanup`:
//   - If a user with username "admin" exists → flush all users.
//   - Otherwise → if a user with username "admin" and password "Password123"
//     exists, delete that single user.
// The behaviour runs once at server boot (called from `src/backend/server.js`).
//
// Restarting the server from inside Playwright is heavier than the rest of
// the suite (which runs against a long-lived stack). Instead this spec
// asserts the **post-cleanup contract** that holds at all times after the
// server has booted: the legacy default `admin` / `Password123` account
// documented in `cleanupAdminPassword123User` is not a valid login on the
// running stack. If a regression ever re-introduced the seed account
// without removing it, this assertion would fail.
//
// Backend coverage of the cleanup logic itself lives in the integration
// tests (`tests/integration/authentication.test.js` startup-cleanup
// subgroup). This spec is the browser-side equivalent that proves the
// promise the use case makes to operators: the legacy default credentials
// cannot be used to authenticate.

const { test, expect, request } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Application startup cleanup (Phase 25.4)', () => {
  test('legacy admin/Password123 account cannot be logged in to', async () => {
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.post(`${BASE_URL}/api/auth/login`, {
        data: { username: 'admin', password: 'Password123' },
      });
      // Either 401 (no such user / wrong password) or 403 (profile-incomplete
      // would be the corner case if the account exists but is unfinished).
      // Anything in the 2xx range means the legacy seed survived cleanup.
      expect(res.status(), `Expected the legacy admin/Password123 account to be rejected, got ${res.status()}`)
        .not.toBeLessThan(400);
      expect(res.status()).toBeLessThan(500);
    } finally {
      await apiCtx.dispose();
    }
  });

  test('GET /api/auth/check-users responds and reports a usable hasUsers flag', async () => {
    // After startup the system must be in one of two well-defined states:
    //   - clean: hasUsers = false (no users yet, first registration will
    //     succeed and become admin)
    //   - seeded: hasUsers = true (an admin already exists; the legacy
    //     admin/Password123 user has been flushed by the same cleanup)
    // Either is acceptable. What is NOT acceptable is the endpoint
    // failing or returning a non-boolean shape.
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.get(`${BASE_URL}/api/auth/check-users`);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(typeof body.hasUsers).toBe('boolean');
    } finally {
      await apiCtx.dispose();
    }
  });
});
