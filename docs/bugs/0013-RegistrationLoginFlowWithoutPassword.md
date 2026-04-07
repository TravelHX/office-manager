# Registration Flow Asks for Login Without Password Bug

## Issue Description

When a user is registered, they are asked to log in. At that stage they have not set a password, so the login flow is incorrect.

**Expected Behavior:** The user enters their email address in a flow that recognizes the email as already in the database. Based on that, they are prompted to complete registration (password, name, and other required fields) rather than a standard login that assumes an existing password.

**Actual Behavior:** After registration, users are directed to log in even though they do not yet have a password, which blocks or confuses the intended onboarding path.

## Current Status

**Status:** Pending Confirmation

**What has been tried:**

1. **Context:** Admin-provisioned users (Phase 19) are created without a password; they must use the invitation link to `complete-profile.html?token=...`. After completing the form, the app previously redirected to the login page even though the API had just accepted their password.

2. **Root issues addressed:**
   - **Post-setup login step:** `POST /api/auth/complete-profile` did not return a session token; the UI sent users to login after they had already set a password. The endpoint now returns a JWT (same as login), and the client stores `authToken` / `user` and redirects to `/` so they are signed in immediately.
   - **Provisioned users at login:** Users with no `password_hash` who tried standard login only saw a generic invalid-credentials error. `UserService.authenticate` now fails with `PROFILE_SETUP_REQUIRED`; `POST /api/auth/login` responds with HTTP 403 and code `PROFILE_SETUP_REQUIRED` and an explicit message to use the invitation setup link.
   - **Broken redirects:** `main.js` sent authenticated users with `profileComplete === false` to `complete-profile.html` without an invitation token (useless). Those users are now signed out and sent to `login.html?setupPending=1` with an on-page hint. `login.js` no longer redirects incomplete-profile users to `complete-profile.html` without a token; it shows an error and does not store a session.
   - **Login page:** Added `login-setup-hint` when `setupPending=1` explains administrator-created accounts need the email setup link first.
   - **Tests:** Integration test for provisioned-user login; frontend tests for `PROFILE_SETUP_REQUIRED`, incomplete profile, setup hint, complete-profile token storage; `login.js` uses `localStorage.getItem('authToken')` for the logged-in check so behavior does not depend on `main.js` globals in tests.

**Current State:**

- Code updated; confirm manually: provision user, open setup link, submit password and location, land on home while logged in; attempt login before setup and see setup-link message; open `login.html?setupPending=1` and see hint.

## Investigation Tasks

1. Map the current registration and post-registration redirect flow (frontend and backend).
2. Identify where the login screen is shown after registration and why.
3. Define or implement the intended flow: email check -> if user exists without completed credentials, show password and profile completion (or equivalent).
4. Ensure backend supports distinguishing "invited" or "registered but not completed" users from fully active users if required.
5. Update copy and routes so users are never asked to log in with a password they have not set.

## Technical Notes

**Likely Affected Areas:**

- Frontend: register, login, complete-profile, and redirect logic.
- Backend: user creation, password setup endpoints, session or token issuance after registration.

**Changed files (summary):** `auth.js` (complete-profile token, login error code), `UserService.js` (authenticate), `complete-profile.js`, `login.js`, `login.html`, `main.js`, tests under `tests/` and `src/frontend/tests/`.

## Next Steps

1. Manually verify flows above in a browser.
2. Run full suite in Docker (`utils/run-tests.ps1`) when available.
3. After you confirm behavior, mark fixed and move to `docs/bugs/fixed/` per project workflow.
