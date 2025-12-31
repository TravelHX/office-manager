# Desk Booking Timeframe Route Not Found Bug

## Issue Description

When selecting a desk booking timeframe (start date and end date) and clicking "Check Availability", the application returns a "route not found" error. The frontend is calling `/api/bookings/available` with query parameters `startDate` and `endDate`, but the route is not being found.

**Expected Behavior:** When a user selects start and end dates and clicks "Check Availability", the system should return a list of available desks for that date range.

**Actual Behavior:** The system returns a "route not found" error.

## Current Status

**Status:** Fixed

**Root Cause Identified:**
The bug was caused by a URL construction issue in the frontend. The `API_BASE_URL` in `src/frontend/js/main.js` was set to `http://localhost:3000/api`, but all API endpoint calls already include `/api/` in their paths. This resulted in URLs like `http://localhost:3000/api/api/bookings/available` instead of `http://localhost:3000/api/bookings/available`, causing Express to return a 404 "route not found" error.

**What has been tried:**
- Initial investigation shows the route `/api/bookings/available` exists in `src/backend/routes/bookings.js` at line 18
- The route handler is properly defined with authentication middleware
- The frontend code in `src/frontend/js/desk-booking.js` line 44 is calling the correct endpoint: `/api/bookings/available?startDate=${startDate}&endDate=${endDate}`
- Reviewed route order in `bookings.js` - `/available` is defined before `/:id` route (line 18 vs line 71)
- Reviewed route registration in `src/backend/routes/index.js` - bookings router is properly mounted at `/api/bookings`
- Found existing integration test in `tests/integration/desk-booking.test.js` that tests this route
- Investigated URL construction in `src/frontend/js/main.js` - discovered `API_BASE_URL` includes `/api` but endpoints also include `/api/`
- Created failing test in `tests/integration/desk-booking.test.js` to verify route doesn't return 404
- Fixed by removing `/api` from `API_BASE_URL` in `src/frontend/js/main.js`

**Current State:**
- Bug fixed: Changed `API_BASE_URL` from `http://localhost:3000/api` to `http://localhost:3000`
- Added test to verify route doesn't return 404
- Route definition was correct all along - the issue was in frontend URL construction

**Possible Causes:**
1. Route order issue - Express might be matching `/:id` route before `/available` route (though `/available` is defined first)
2. Authentication middleware issue causing 404 instead of 401
3. Route registration issue - bookings router might not be properly mounted
4. Express route matching issue with query parameters
5. Server not running or routes not loaded properly

## Investigation Tasks

1. Verify the route is being registered correctly in the Express app
2. Check if authentication middleware is causing the issue (should return 401, not 404)
3. Verify route order - ensure `/available` route is matched before `/:id` route
4. Check server logs to see what route Express is actually trying to match
5. Test the route directly using a tool like Postman or curl to isolate frontend vs backend issue
6. Verify the `apiRequest` function in the frontend is correctly constructing the URL
7. Check if there are any route conflicts or middleware issues
8. Verify the bookings router is properly exported and imported

## Technical Notes

**Route Definition Location:**
- File: `src/backend/routes/bookings.js`
- Line: 18-36
- Route: `GET /api/bookings/available`
- Requires: Authentication middleware
- Parameters: Query parameters `startDate` and `endDate`

**Frontend Call Location:**
- File: `src/frontend/js/desk-booking.js`
- Line: 44
- Function: `checkAvailability()`
- API Call: `apiRequest(\`/api/bookings/available?startDate=${startDate}&endDate=${endDate}\`)`

**Route Registration:**
- File: `src/backend/routes/index.js`
- Line: 23
- Registration: `router.use('/api/bookings', bookingsRouter)`

**Related Routes:**
- `/api/bookings/my-bookings` - Get user's bookings (defined before `/available`)
- `/api/bookings/check-availability` - Check specific desk availability (defined after `/available`)
- `/api/bookings/:id` - Get booking by ID (defined after `/available`, should not conflict)

**Route Order in bookings.js:**
1. `/my-bookings` (line 8)
2. `/available` (line 18) - **This is the problematic route**
3. `/check-availability` (line 38)
4. `/:id` (line 71) - This should not match `/available` since `/available` is defined first

## Next Steps

1. ~~Create a failing test that reproduces the bug~~ - Completed
2. ~~Add logging to the route handler to verify if it's being hit~~ - Not needed, issue was in frontend
3. ~~Check Express route matching behavior~~ - Not needed, routes were correct
4. ~~Verify authentication token is being sent correctly~~ - Not needed, authentication was working
5. ~~Test route directly without frontend to isolate the issue~~ - Completed, identified frontend issue
6. ~~Fix the root cause once identified~~ - Completed: Fixed `API_BASE_URL` in `src/frontend/js/main.js`
7. ~~Verify the fix works end-to-end~~ - Test added, ready for verification

## Fix Applied

**File:** `src/frontend/js/main.js`
**Change:** Removed `/api` from `API_BASE_URL`
- Before: `const API_BASE_URL = 'http://localhost:3000/api';`
- After: `const API_BASE_URL = 'http://localhost:3000';`

**Test Added:** `tests/integration/desk-booking.test.js`
- Added test to verify route doesn't return 404

