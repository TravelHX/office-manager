# No Overlapping Desk Booking Validation Bug

## Issue Description

When creating a desk booking, there is no validation to prevent creating overlapping bookings for the same desk. Users can book a desk for dates that overlap with existing active bookings.

**Expected Behavior:** When attempting to create a desk booking for dates that overlap with an existing active booking for the same desk, the system should reject the request and return an error indicating the desk is already booked for overlapping dates.

**Actual Behavior:** The system allows creating bookings with overlapping dates for the same desk, resulting in double-booking conflicts.

## Current Status

**Status:** Fixed - User Confirmed

**What has been tried:**
- Reviewed the `findConflictingBookings()` query logic
- Identified that the conflict detection query was overly complex and potentially buggy
- Simplified the query to use standard date range overlap check
- Verified the fix correctly detects all overlap scenarios

**Current State:**
- `BookingService.createBooking()` calls `deskService.checkDeskAvailability()` before creating booking
- `checkDeskAvailability()` uses `findConflictingBookings()` to check for conflicts
- The conflict detection query should find overlapping bookings, but may not be working correctly

**Possible Causes:**
1. The conflict detection query logic might be incorrect or incomplete
2. The date comparison logic might not correctly identify all overlap scenarios
3. The availability check might not be called before creating the booking
4. There might be a timezone or date format issue affecting comparisons

## Investigation Tasks

1. Review the `findConflictingBookings()` query logic to verify it detects all overlap scenarios
2. Test various overlap scenarios:
   - New booking starts before existing ends
   - New booking ends after existing starts
   - New booking completely contains existing booking
   - Existing booking completely contains new booking
   - New booking exactly matches existing booking
3. Verify that `checkDeskAvailability()` is being called before booking creation
4. Check if date format or timezone issues are affecting comparisons
5. Verify the SQL date comparison logic handles all edge cases

## Technical Notes

**Booking Service:**
- File: `src/backend/services/BookingService.js`
- Method: `createBooking()` (line 13)
- Calls: `deskService.checkDeskAvailability(deskId, startDate, endDate)` (line 44)
- Should throw error if `availability.available` is false

**Desk Service:**
- File: `src/backend/services/DeskService.js`
- Method: `checkDeskAvailability()` (line 93)
- Calls: `bookingRepository.findConflictingBookings()` (line 103)

**Booking Repository:**
- File: `src/backend/repositories/BookingRepository.js`
- Method: `findConflictingBookings()` (line 42)
- Query checks for overlapping dates:
  - `(start_date <= ? AND end_date >= ?)` - existing overlaps at new start
  - `(start_date <= ? AND end_date >= ?)` - existing overlaps at new end
  - `(start_date >= ? AND end_date <= ?)` - existing completely within new

**Overlap Scenarios:**
- Scenario 1: New booking (Jan 1-5), Existing (Jan 3-7) - should detect overlap
- Scenario 2: New booking (Jan 3-7), Existing (Jan 1-5) - should detect overlap
- Scenario 3: New booking (Jan 1-10), Existing (Jan 3-5) - should detect overlap
- Scenario 4: New booking (Jan 3-5), Existing (Jan 1-10) - should detect overlap

## Next Steps

1. ~~Create a failing test that reproduces the bug~~ - Completed
2. ~~Review and fix the conflict detection query~~ - Completed
3. ~~Verify all overlap scenarios are correctly detected~~ - Completed
4. ~~Verify the fix prevents overlapping bookings~~ - Completed (tests verified)
5. ~~User confirmation required before marking as fixed~~ - ✅ Confirmed fixed by user on 2026-02-05

## Fix Applied

**Root Cause Identified:**
The `findConflictingBookings()` query in `BookingRepository` used a complex three-condition check that was potentially buggy and didn't correctly detect all overlap scenarios.

**Fix Applied:**
Simplified the conflict detection query in `src/backend/repositories/BookingRepository.js` to use the standard date range overlap check:
- Changed from complex three-condition OR logic to simple: `start_date <= endDate AND end_date >= startDate`
- This single condition correctly detects all overlap scenarios:
  - Overlaps at start
  - Overlaps at end
  - New booking completely within existing
  - Existing booking completely within new
  - Exact duplicates

**Test Coverage:**
- Added tests in `tests/integration/desk-booking.test.js` to verify overlapping bookings are rejected for various scenarios

