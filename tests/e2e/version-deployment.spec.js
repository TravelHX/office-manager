// Phase 25.8 — End-to-end: version tracking on deployment.
//
// Covers the deferred Playwright task from Phase 18 (automatic version
// tracking). The deployed app exposes its version in three places that all
// need to agree:
//   1. GET /api/version (server, sourced from app_version table after the
//      startup version-sync routine runs against the value in
//      data/config.json's deployment_info.version).
//   2. The footer #version-number span on every page that mounts the shell
//      footer (login is a public page that always renders it).
//   3. The browser localStorage key 'appVersion' that main.js sets after a
//      successful /api/version fetch (used by other client code to gate
//      version-aware behavior).
//
// What this test asserts:
//   - The footer renders the same version string the API returns.
//   - The version is a non-trivial value (not the literal "-" placeholder
//     before main.js loads it, and not the "Unknown" failure fallback).
//   - localStorage.appVersion matches the API response after page load.
//
// The test does not assume the running version equals any specific number;
// the deployment_info.version in data/config.json is the source of truth and
// can change between releases. We only assert the three sources agree.
//
// The test is idempotent: it makes no DB writes and can run on a dirty stack
// alongside the rest of the e2e suite.

const { test, expect, request } = require('@playwright/test');

test.describe('Version tracking on deployment (Phase 25.8)', () => {
  let apiVersionNumber;

  test.beforeAll(async () => {
    const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
    const apiCtx = await request.newContext();
    try {
      const res = await apiCtx.get(`${baseURL}/api/version`);
      if (!res.ok()) {
        throw new Error(`GET /api/version returned HTTP ${res.status()}`);
      }
      const body = await res.json();
      if (!body || typeof body.versionNumber !== 'string' || !body.versionNumber.trim()) {
        throw new Error(`/api/version returned no versionNumber: ${JSON.stringify(body)}`);
      }
      apiVersionNumber = body.versionNumber.trim();
    } finally {
      await apiCtx.dispose();
    }
  });

  test('footer version, /api/version, and localStorage all agree', async ({ page }) => {
    // The login page is public (no check-users redirect) and renders the
    // shared footer. Use it to avoid the seed-user dependency of authenticated
    // pages.
    await page.goto('/pages/login.html');

    const versionNumber = page.locator('#version-number');
    await expect(versionNumber).toBeVisible();

    // main.js fetches /api/version after DOMContentLoaded and replaces the
    // "-" placeholder with the live version. Wait for that swap.
    await expect(versionNumber).not.toHaveText('-', { timeout: 10_000 });
    await expect(versionNumber).not.toHaveText('Unknown', { timeout: 10_000 });

    const renderedVersion = (await versionNumber.textContent() || '').trim();
    expect(renderedVersion).toBe(apiVersionNumber);

    // The same version is cached in localStorage by loadAppVersion() so other
    // client code can read it without re-hitting the API.
    const storedVersion = await page.evaluate(() => window.localStorage.getItem('appVersion'));
    expect(storedVersion).toBe(apiVersionNumber);

    // Sanity check on shape: a non-empty, dot-separated semver-like value
    // (e.g. "1.0.0.0"). We do not enforce the exact format here because the
    // server normalises whatever data/config.json carries, but it should
    // never be a placeholder string.
    expect(renderedVersion.length).toBeGreaterThan(0);
    expect(renderedVersion).not.toMatch(/^(loading|unknown|-)$/i);
  });
});
