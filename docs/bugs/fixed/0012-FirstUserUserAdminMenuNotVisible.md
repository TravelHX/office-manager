# First User Cannot See User Admin Menu Bug

## Issue Description

When registering as the first user (initial admin), the User Admin menu should be visible so the admin can manage users. Currently the first user cannot see the User Admin menu.

**Expected Behavior:** After registering as the first user, the admin should see the User Admin menu (or equivalent navigation) and be able to access user administration.

**Actual Behavior:** The User Admin menu is not shown to the first user, so they cannot access user administration as intended.

## Current Status

**Status:** Fixed - User Confirmed

**What has been tried:**

1. **Investigation:** Admin dashboard shows User Management when `isAdmin()` is true (`src/frontend/js/admin.js`). `isAdmin()` reads `localStorage` user from `src/frontend/js/main.js`.

2. **Root cause (backend / data):** `UserService.registerUser` used `userCount === 0` to detect the first user. MySQL `COUNT(*)` is often returned by the driver as a **string** (for example `"0"`). The expression `"0" === 0` is false, so the first registrant was created as a non-admin. The stored user then had `role: 'user'` and the User Management tab stayed hidden.

3. **Root cause (frontend load):** `main.js` declared a top-level `async function apiRequest`, which binds the global name `apiRequest`. `admin.js` then declared `const apiRequest`, causing `Uncaught SyntaxError: Identifier 'apiRequest' has already been declared` so `admin.js` never ran and User Management never appeared. **Fix:** rename the implementation in `main.js` to `mainApiRequest` and assign `globalThis.apiRequest = mainApiRequest` (see `module.exports.apiRequest` for tests).

4. **Other fixes applied:**
   - `getUserCount()` and `getAdminCount()` in `src/backend/services/UserService.js` now coerce the repository count with `Number(...)` and return a finite number (or 0), so first-user detection works regardless of string vs number from the driver.
   - `isAdmin()` in `src/frontend/js/main.js` treats role `admin` case-insensitively, boolean/numeric `isAdmin` / `is_admin`, and string `'1'` where drivers serialize flags that way.
   - **Stale client state:** On `admin.html` load, `admin.js` awaits `syncCurrentUserFromServer()` (GET `/api/auth/me`) so `localStorage` user matches the database before showing **User Management**.
   - **Authoritative UI gate:** `serverAllowsUserManagement()` in `main.js` performs GET `/api/auth/users` (same auth as the User Management feature). `admin.js` shows the sidebar item when that returns **200**, with fallback to `isAdmin()` if the probe fails.
   - **User model:** `is_admin` from the driver is parsed with `parseIsAdmin()` so string `'0'` / `'1'` and similar values do not mis-classify admins (avoids `Boolean('0') === true`).

5. **Tests:** `tests/services/UserService.test.js` (includes User `parseIsAdmin`), `src/frontend/tests/main.test.js` (`isAdmin`, `syncCurrentUserFromServer`, `serverAllowsUserManagement`).

**Current State:**

- User confirmed User Management appears on the admin dashboard after fixes.
- Bug archived under `docs/bugs/fixed/`.

## Investigation Tasks

1. Locate where the User Admin menu visibility is controlled (frontend shell, role checks, feature flags).
2. Verify how the first user (initial admin) role is assigned and persisted after registration.
3. Confirm whether the session or JWT claims include admin role for the first user.
4. Check for conditions that hide User Admin until a certain user count or flag is set incorrectly.
5. Align menu visibility with the role and permissions of the initial admin user.

## Technical Notes

**Likely Affected Areas:**

- Frontend: navigation, sidebar, or menu rendering logic.
- Backend: auth, user registration for first user, role assignment (admin).

**Fix location:** `UserService.getUserCount` / `getAdminCount` normalization; `main.js` `isAdmin()`; `main.js` global naming vs `admin.js` delegate.

## Next Steps

1. None; bug closed.
