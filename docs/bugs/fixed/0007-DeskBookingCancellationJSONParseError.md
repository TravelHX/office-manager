# Desk Booking Cancellation JSON Parse Error Bug (and Parking Reservation Undefined Parameter Error)

## Issue Description

**Issue 1:** When cancelling a desk reservation, the application throws a JSON parsing error: "Failed to execute 'json' on 'Response': Unexpected end of JSON input". The cancellation appears to succeed on the backend, but the frontend fails to handle the empty response.

**Issue 2:** When reserving a parking space, the application throws an error: "Bind parameters must not contain undefined. To pass SQL NULL specify JS null". This occurs because optional fields in the ParkingReservation model are being passed as `undefined` instead of being omitted or set to `null`.

**Expected Behavior:** 
- When cancelling a desk booking, the system should successfully cancel the booking and display a success message without any errors.
- When reserving a parking space, the system should successfully create the reservation without parameter binding errors.

**Actual Behavior:** 
- The system throws a JSON parsing error when trying to parse the empty response body from the DELETE endpoint (which returns HTTP 204 No Content).
- The system throws a parameter binding error when creating parking reservations because `undefined` values are being passed to the database.

## Current Status

**Status:** Fixed - User Confirmed

**What has been tried:**
- Identified that DELETE endpoint returns HTTP 204 No Content (empty body)
- Identified that `apiRequest()` always tries to parse JSON regardless of status code
- Fixed `apiRequest()` to handle 204 No Content responses without parsing JSON
- Fixed `apiRequest()` to check content-type before parsing JSON
- Identified that `ParkingReservation.toDatabaseFormat()` includes `undefined` values for optional fields
- Fixed `ParkingReservation.toDatabaseFormat()` to exclude undefined values (similar to Booking model fix)

**Current State:**
- DELETE endpoint `/api/bookings/:id` returns HTTP 204 No Content (empty body) on success
- Frontend `apiRequest()` function now checks for 204 status and skips JSON parsing
- Frontend `apiRequest()` function now checks content-type before parsing JSON
- `ParkingReservation.toDatabaseFormat()` now excludes undefined optional fields

**Root Cause Identified:**

**Issue 1 - JSON Parse Error:**
The DELETE endpoint correctly returns HTTP 204 No Content (empty response body) for successful deletions, which is the standard HTTP response for DELETE operations. However, the frontend's `apiRequest()` function in `src/frontend/js/main.js` always called `response.json()` regardless of the response status code, which failed when the response body was empty (as it is for 204 responses).

**Issue 2 - Undefined Parameter Error:**
The `ParkingReservation.toDatabaseFormat()` method in `src/backend/models/ParkingReservation.js` was including optional fields (`cancelled_at`, `cancelled_by`, `cancellation_reason`) even when they were `undefined`. MySQL's parameter binding doesn't accept `undefined` values - it requires `null` or the field should be omitted entirely. When creating a new reservation, these fields are `undefined`, causing the parameter binding error.

**Fix Applied:**
Modified `apiRequest()` in `src/frontend/js/main.js` to:
1. Check if response status is 204 and return null immediately (no JSON parsing)
2. Check content-type header before attempting JSON parsing
3. Use `response.text()` first to check if body is empty before parsing
4. Only parse JSON if content-type indicates JSON and body is not empty

## Investigation Tasks

1. Verify the DELETE endpoint returns 204 No Content on success
2. Check the `apiRequest()` function to see how it handles responses
3. Fix `apiRequest()` to handle 204 No Content responses without trying to parse JSON
4. Test cancellation to verify it works without errors

## Technical Notes

**DELETE Booking Endpoint:**
- File: `src/backend/routes/bookings.js`
- Route: `DELETE /api/bookings/:id` (line 147)
- Returns: `res.status(204).send()` on success (empty body)

**Frontend API Request Function:**
- File: `src/frontend/js/main.js`
- Function: `apiRequest()` (line 25)
- Always calls `response.json()` regardless of status code
- Line 101: `const data = await response.json();`

**Frontend Cancel Booking Function:**
- File: `src/frontend/js/bookings.js`
- Function: `cancelBooking()` (line 254)
- Calls: `apiRequest('/api/bookings/${bookingId}', { method: 'DELETE' })`

**HTTP 204 No Content:**
- Standard HTTP status code for successful DELETE operations
- Response body is empty (no content)
- Should not be parsed as JSON

## Next Steps

1. ~~Create a failing test that reproduces the bug~~ - Completed (added test for 204 No Content handling)
2. ~~Fix `apiRequest()` to handle 204 No Content responses~~ - Completed
3. ~~Verify cancellation works without errors~~ - ✅ Confirmed fixed by user
4. ~~Test with other DELETE endpoints to ensure consistency~~ - Fix applies to all DELETE endpoints

## Fix Applied

**Root Cause Identified:**

**Issue 1 - JSON Parse Error:**
The DELETE endpoint correctly returns HTTP 204 No Content (empty response body) for successful deletions, which is the standard HTTP response for DELETE operations. However, the frontend's `apiRequest()` function in `src/frontend/js/main.js` always called `response.json()` regardless of the response status code, which failed when the response body was empty (as it is for 204 responses).

**Issue 2 - Undefined Parameter Error:**
The `ParkingReservation.toDatabaseFormat()` method in `src/backend/models/ParkingReservation.js` was including optional fields (`cancelled_at`, `cancelled_by`, `cancellation_reason`) even when they were `undefined`. MySQL's parameter binding doesn't accept `undefined` values - it requires `null` or the field should be omitted entirely. When creating a new reservation, these fields are `undefined`, causing the parameter binding error.

**Fix Applied:**

**Fix 1 - JSON Parse Error:**
Modified `apiRequest()` in `src/frontend/js/main.js` to:
1. Check if response status is 204 and return null immediately (no JSON parsing)
2. Check content-type header before attempting JSON parsing
3. Use `response.text()` first to check if body is empty before parsing
4. Only parse JSON if content-type indicates JSON and body is not empty

**Fix 2 - Undefined Parameter Error:**
Modified `toDatabaseFormat()` in `src/backend/models/ParkingReservation.js` to:
1. Only include optional fields (`cancelled_at`, `cancelled_by`, `cancellation_reason`) if they have values
2. Exclude undefined values from the database format object
3. Prevents MySQL parameter binding errors when optional fields are undefined

**Affected Endpoints:**
This fix applies to all DELETE endpoints that return 204 No Content:
- `/api/bookings/:id` - Cancel booking
- `/api/parking-reservations/:id` - Cancel parking reservation
- `/api/parking-spaces/:id` - Delete parking space
- `/api/overtime/:id` - Delete overtime record
- `/api/desks/:id` - Delete desk
- `/api/admin/config/desk-count` - Reset desk count
- `/api/admin/config/parking-count` - Reset parking count

**Test Coverage:**
- Added unit test in `src/frontend/tests/main.test.js` to verify 204 No Content responses are handled correctly without JSON parsing
- Added unit test to verify non-JSON responses are handled gracefully
- Manual testing required to verify cancellation works without errors
- Manual testing required to verify parking reservation creation works without parameter binding errors

**Files Modified:**
- `src/frontend/js/main.js` - Fixed `apiRequest()` to handle 204 No Content responses
- `src/backend/models/ParkingReservation.js` - Fixed `toDatabaseFormat()` to exclude undefined values

