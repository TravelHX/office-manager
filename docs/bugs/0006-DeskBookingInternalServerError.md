# Desk Booking Internal Server Error Bug

## Issue Description

When attempting to create a desk booking, the application returns an "Internal server error" (HTTP 500). The booking creation fails with a generic error message.

**Expected Behavior:** When creating a desk booking, the system should either successfully create the booking and return the booking details, or return a specific error message indicating what went wrong (e.g., desk not found, desk unavailable, invalid dates, etc.).

**Actual Behavior:** The system returns a generic "Internal server error" (HTTP 500) when attempting to create a booking, providing no specific information about what went wrong.

## Current Status

**Status:** Open - Investigation Needed

**What has been tried:**
- Improved error handling in booking route to catch foreign key constraint violations
- Fixed `toDatabaseFormat()` to exclude undefined values for optional fields
- Added null check in `BookingRepository.create()` after `findById` call
- Added better error logging to identify the root cause

**Current State:**
- Booking creation route has error handling for common cases
- Error handler should catch MySQL errors (ER_* codes)
- Foreign key constraints exist on bookings table for user_id and desk_id
- Default user with id=1 exists in database schema

**Possible Causes:**
1. Foreign key constraint violation - user_id or desk_id doesn't exist in database
2. Desk doesn't exist - but this should be caught before booking creation
3. Database connection issue
4. Error in `findById` after booking creation
5. Error in `toJSON()` when returning booking
6. Undefined values in booking data causing SQL errors
7. Error in conflict detection query

## Investigation Tasks

1. Check backend logs to see the actual error message and stack trace
2. Verify that the desk exists in the database
3. Verify that the user with id=1 exists in the database
4. Test booking creation with a known valid desk ID
5. Check if the error occurs during INSERT or during the subsequent findById call
6. Verify foreign key constraints are working correctly
7. Check if there are any issues with date format or data types

## Technical Notes

**Booking Creation Flow:**
- File: `src/backend/routes/bookings.js`
- Route: `POST /api/bookings`
- Calls: `bookingService.createBooking(userId, deskId, startDate, endDate)`

**BookingService:**
- File: `src/backend/services/BookingService.js`
- Method: `createBooking()` (line 13)
- Validates dates, checks desk exists, checks availability, creates booking

**BookingRepository:**
- File: `src/backend/repositories/BookingRepository.js`
- Method: `create()` (line 63)
- Converts booking to database format, inserts, then retrieves via findById

**Error Handler:**
- File: `src/backend/middleware/error-handler.js`
- Should catch MySQL errors (ER_* codes) and foreign key violations
- Returns 500 for unhandled errors

**Database Schema:**
- Bookings table has FOREIGN KEY constraints:
  - `user_id REFERENCES users(id) ON DELETE CASCADE`
  - `desk_id REFERENCES desks(id) ON DELETE CASCADE`

## Next Steps

1. Create a failing test that reproduces the bug
2. Check backend logs to identify the actual error
3. Verify database state (user exists, desk exists)
4. Fix the root cause once identified
5. Verify the fix works end-to-end

