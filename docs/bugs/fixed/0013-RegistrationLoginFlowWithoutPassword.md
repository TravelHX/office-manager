# Registration Flow Asks for Login Without Password Bug

## Issue Description

When a user is registered, they are asked to log in. At that stage they have not set a password, so the login flow is incorrect.

**Expected Behavior:** The user enters their email address in a flow that recognizes the email as already in the database. Based on that, they are prompted to complete registration (password, name, and other required fields) rather than a standard login that assumes an existing password.

**Actual Behavior (before fix):** After registration, users were directed to log in even though they did not yet have a password, or were told to use an email invitation link when no email was configured.

## Current Status

**Status:** Fixed - User Confirmed

**What has been tried:**

1. **Post-setup session:** `POST /api/auth/complete-profile` returns a JWT; client stores token and redirects home.

2. **Provisioned users at login:** `UserService.performLogin` detects users with no `password_hash` and a valid invitation token; `POST /api/auth/login` responds with **403** `PROFILE_SETUP_REQUIRED` and **`profileSetupUrl`**. The login page **redirects** to that URL so the user sets password and office without email.

3. **Unknown email:** When the email is not in the system (and the deployment already has users), login returns **401** `UNKNOWN_USER` with a message that an **administrator must create** the account.

4. **Self-registration:** Only when **no users exist**. If users exist, `register.html` redirects to `login.html?needsAdmin=1`.

5. **No outbound email:** Forgot-password page is static; **POST /api/auth/forgot-password** returns guidance only. Admins use User Management / `requestPasswordReset` out of band.

6. **Copy:** Admin provisioning and login hints describe login-first flow and optional copied setup URL.

**Tests:** `UserService.performLogin`; integration login, forgot-password, register closed, password-reset E2E; frontend login, register, forgot-password, user-creation-form tests.

## Investigation Tasks

1. Map the current registration and post-registration redirect flow (frontend and backend).
2. Identify where the login screen is shown after registration and why.
3. Define or implement the intended flow: email check -> if user exists without completed credentials, show password and profile completion (or equivalent).
4. Ensure backend supports distinguishing provisioned users from fully active users if required.
5. Update copy and routes so users are never asked to log in with a password they have not set.

## Technical Notes

**Affected areas:** Frontend register, login, complete-profile, forgot-password; backend `UserService.performLogin`, `registerUser`, `auth` routes.

## Next Steps

1. None; bug closed.
