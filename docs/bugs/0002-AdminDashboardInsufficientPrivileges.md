# Admin Dashboard Insufficient Privileges Bug

## Issue Description

When attempting to create desks and parking spaces in the admin dashboard (e.g., setting 10 desks and 5 parking spaces), the application returns an "insufficient privileges" error. The user is unable to update the desk count or parking count configuration through the admin interface.

**Expected Behavior:** When a user with admin privileges accesses the admin dashboard and attempts to set desk count and parking count, the system should successfully update the configuration and create the specified number of desks and parking spaces.

**Actual Behavior:** The system returns an "insufficient privileges" error (HTTP 403) when attempting to update desk count or parking count.

## Current Status

**Status:** Open - Investigation Needed

**What has been tried:**
- No investigation has been performed yet

**Current State:**
- Admin routes require `authorize(['admin'])` middleware
- Authentication middleware checks user role from database or token prefix
- Frontend admin dashboard calls `/api/admin/configuration/desk-count` and `/api/admin/configuration/parking-count` endpoints
- Error message indicates insufficient permissions (403 Forbidden)

**Possible Causes:**
1. User token does not have "admin_" prefix, so role is not set to 'admin'
2. User does not exist in database with role='admin'
3. Frontend is not sending the correct authentication token
4. Token is being sent but user role is not being correctly determined
5. Authorization middleware is not correctly checking the user role

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

1. Create a failing test that reproduces the bug
2. Check what token is being used in the frontend when accessing admin dashboard
3. Verify the authentication flow and role assignment
4. Test with an admin token to confirm the endpoints work correctly
5. Check if users table has any admin users
6. Verify the frontend is correctly obtaining and sending admin token
7. Fix the root cause once identified
8. Verify the fix works end-to-end

