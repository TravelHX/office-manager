# Non-Admin Users Can See the Admin Navigation Link

## Issue Description

Users who are **not** administrators can see an **Admin** entry in the application navigation (left sidebar on main app pages). They should not see any admin entry point in the UI; only administrators should.

**Expected Behavior:** The Admin link (or equivalent route to `admin.html`) appears **only** for users who have admin privileges (`isAdmin` / `role: admin` as enforced by the application). Non-admin users should have no visible admin menu item.

**Actual Behavior:** The Admin link is present in static HTML for multiple pages (for example home, desk booking, parking, bookings, matrix), so any user who can load those pages sees the link. Backend APIs may still reject non-admins, but the UI exposes admin navigation incorrectly.

## Current Status

**Status:** Open

**What has been tried:**

1. None yet.

## Investigation Tasks

1. Inventory every place the Admin link or admin dashboard route appears (sidebar markup in HTML, any JavaScript that injects nav items).
2. Confirm how `isAdmin()` / `getCurrentUser()` in `src/frontend/js/main.js` can be used (or extended) after `syncCurrentUserFromServer` so nav visibility matches server truth.
3. Decide pattern: hide Admin `<li>` by default and show only when `isAdmin()` is true on `DOMContentLoaded`, or server-rendered fragment (if applicable), or shared partial; keep behavior consistent across all shell pages.
4. Verify `admin.html` still redirects or shows a clear error for non-admins if the URL is opened directly (defense in depth; backend already uses `authorize(['admin'])` on APIs).
5. Add or update a test (unit or UI) that non-admin user context does not surface the Admin nav link.

## Technical Notes

**Likely affected areas:**

- `src/frontend/index.html` and app pages under `src/frontend/pages/` that include `<a href="/pages/admin.html">Admin</a>` in `.sidebar-nav`.
- `src/frontend/js/main.js` (`DOMContentLoaded`, `updateUserIndicator`, or a small helper such as `updateAdminNavVisibility()`).
- Optional: `admin.html` / `admin.js` client-side gate for clearer UX when a non-admin hits the page directly.

## Next Steps

1. Implement conditional visibility for the Admin nav item for non-admin users.
2. Manually verify as a normal user: no Admin link; as admin: link present.
3. Run tests (`utils/run-tests.ps1` in Docker when available).
4. After user confirmation, mark fixed and move to `docs/bugs/fixed/` per project workflow.
