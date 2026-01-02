# Admin Dashboard Insufficient Privileges Bug

## Issue Description

When attempting to create desks and parking spaces in the admin dashboard (e.g., setting 10 desks and 5 parking spaces), the application returns an "insufficient privileges" error. The user is unable to update the desk count or parking count configuration through the admin interface.

**Expected Behavior:** When a user with admin privileges accesses the admin dashboard and attempts to set desk count and parking count, the system should successfully update the configuration and create the specified number of desks and parking spaces.

**Actual Behavior:** The system returns an "insufficient privileges" error (HTTP 403) when attempting to update desk count or parking count.

## Current Status

**Status:** Fixed - Confirmed by User

**What has been tried:**
- Investigated the `getAuthToken()` function in `src/frontend/js/main.js`
- Identified that the function always generated `user_` prefixed tokens regardless of page context
- Created failing tests to reproduce the bug
- Fixed the `getAuthToken()` function to detect admin pages and generate `admin_` prefixed tokens

**Root Cause Identified:**
The `getAuthToken()` function in `src/frontend/js/main.js` always generated tokens with the `user_` prefix, even when accessing the admin dashboard. The backend authentication middleware checks for tokens starting with `admin_` to grant admin privileges. Since the frontend always sent `user_` prefixed tokens, the backend assigned the role as 'user', causing 403 Forbidden errors on admin endpoints.

**Fix Applied:**
Modified `getAuthToken()` in `src/frontend/js/main.js` to:
1. Detect if the current page is an admin page by checking `window.location.pathname` for 'admin'
2. Use separate localStorage keys for admin and user tokens (`admin_auth_token` vs `auth_token`)
3. Generate tokens with the appropriate prefix (`admin_` for admin pages, `user_` for regular pages)

**Test Coverage:**
- Added tests in `src/frontend/tests/main.test.js` to verify:
  - `getAuthToken()` returns admin token when on admin page
  - `getAuthToken()` returns user token when not on admin page
  - `apiRequest()` uses admin token when on admin page

## Investigation Tasks

1. Verify what authentication token is being used when accessing admin dashboard
2. Check if the token has "admin_" prefix or if user exists in database with admin role
3. Verify the authentication middleware is correctly setting req.user.role to 'admin'
4. Check if the authorization middleware is correctly checking the role
5. Review frontend admin.js to see how authentication token is obtained and sent
6. Test the admin endpoints directly with an admin token to verify they work
7. Check database to see if any users exist with role='admin'
8. Verify the error response code and message to confirm it's a 403 Forbidden

## Technical Notes

**Admin Route Protection:**
- File: `src/backend/routes/admin.js`
- Routes: 
  - `PUT /api/admin/configuration/desk-count` (line 21)
  - `PUT /api/admin/configuration/parking-count` (line 49)
- Middleware: `authenticate, authorize(['admin'])`
- Both routes require admin role

**Authentication Middleware:**
- File: `src/backend/middleware/auth.js`
- Function: `authenticate()` (line 3)
- Role determination logic:
  - If token starts with "admin_", sets `isAdmin = true` and role to 'admin'
  - Tries to fetch user from database to get role
  - If user doesn't exist in DB, uses defaults based on token prefix
  - Sets `req.user.role` based on database role or token prefix

**Authorization Middleware:**
- File: `src/backend/middleware/auth.js`
- Function: `authorize(roles)` (line 80)
- Checks if `req.user.role` is in the allowed roles array
- Returns 403 with "Insufficient permissions" if role doesn't match

**Frontend Admin Dashboard:**
- File: `src/frontend/js/admin.js`
- Function: `saveConfiguration()` (line 40)
- Calls: 
  - `PUT /api/admin/configuration/desk-count` with `{ deskCount }`
  - `PUT /api/admin/configuration/parking-count` with `{ parkingCount }`
- Uses `apiRequest()` function which includes Authorization header

**Token Format:**
- Admin tokens should start with "admin_" prefix (e.g., "admin_1")
- User tokens start with "user_" prefix (e.g., "user_1")
- Token is extracted from Authorization header: "Bearer {token}"

**Error Response:**
- Status Code: 403 Forbidden
- Error Code: 'FORBIDDEN'
- Error Message: 'Insufficient permissions'

## Next Steps

1. ~~Create a failing test that reproduces the bug~~ - Completed
2. ~~Check what token is being used in the frontend when accessing admin dashboard~~ - Completed (identified issue)
3. ~~Verify the authentication flow and role assignment~~ - Completed
4. ~~Fix the root cause once identified~~ - Completed
5. ~~Verify the fix works end-to-end~~ - Completed (tests pass)
6. ~~User confirmation required before marking as fixed~~ - Completed (user confirmed fix)

