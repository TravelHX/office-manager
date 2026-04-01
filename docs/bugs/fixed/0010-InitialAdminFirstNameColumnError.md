# Initial Admin Creation - Unknown Column 'first_name' Bug

## Issue Description

When creating the initial admin user, the following error occurs:

```
Unknown column 'first_name' in 'field list'
```

**Expected Behavior:** The initial admin user should be created successfully without database errors.

**Actual Behavior:** A database error occurs indicating that the `first_name` column does not exist in the target table.

## Current Status

**Status:** Fixed - User Confirmed

**What has been tried:**
- Investigated the `initializeDevAdminUser()` method in `UserService.js`
- Reviewed database schema files (`02-schema.sql` and `06-user-profile-migration.sql`)
- Identified that SQL files in `/docker-entrypoint-initdb.d` only run on first database initialization
- If database was created before `first_name` column was added, the column wouldn't exist
- Created migration runner to ensure database schema is always up to date on application startup
- Added test case to verify `initializeDevAdminUser()` works correctly

**Current State:**
- Root cause identified: Database table was missing `first_name` column because migrations only run on first initialization
- Fix applied: Created migration runner that checks for missing columns and adds them on application startup
- Migration runner ensures `first_name`, `last_name`, `office_location`, `is_admin`, `reset_token`, and `reset_token_expiry` columns exist
- Test added: Added test case in `UserService.test.js` to verify admin user creation works correctly

## Investigation Tasks

1. Locate the code that creates the initial admin user
2. Identify the database table and schema used for the admin/user creation
3. Compare the INSERT/UPDATE query field list with the actual table schema
4. Determine whether `first_name` column is missing from the table or the query uses incorrect column names
5. Check if the users table uses different column naming (e.g., `first_name` vs `firstName` or other convention)
6. Review migrations to ensure the users table schema matches what the code expects

## Technical Notes

**Error Type:** SQL/database schema mismatch

**Likely Affected Areas:**
- Backend: User creation/registration logic (UserService, UserRepository, auth routes)
- Database: users table schema, migrations
- Initial admin setup script or endpoint

**Possible Causes:**
1. The users table was created without a `first_name` column
2. The column may be named differently (e.g., `firstName`, `firstname`)
3. Migration may not have been run or is out of sync
4. Schema was changed but the creation code was not updated

## Fix Applied

**Root Cause Identified:**
The database table was missing the `first_name` column (and potentially other columns from the migration). This occurred because:
1. SQL files in `/docker-entrypoint-initdb.d` only execute when the database is first initialized
2. If the database was created before `first_name` was added to the schema, the column wouldn't exist
3. The `CREATE TABLE IF NOT EXISTS` statement doesn't modify existing tables, so the column was never added

**Fix Applied:**
1. Created `src/backend/database/migrations.js` - A migration runner that checks if required columns exist and adds them if missing
2. The migration runner checks for `first_name` column existence using `information_schema.COLUMNS`
3. If the column doesn't exist, it runs the migration SQL to add:
   - `first_name VARCHAR(100) NULL`
   - `last_name VARCHAR(100) NULL`
   - `office_location VARCHAR(50) NULL`
   - `is_admin BOOLEAN NOT NULL DEFAULT FALSE`
   - `reset_token VARCHAR(255) NULL`
   - `reset_token_expiry TIMESTAMP NULL`
4. Also creates indexes (`idx_is_admin`, `idx_reset_token`) if they don't exist
5. Integrated migration runner into `src/backend/server.js` startup sequence to run before other operations
6. Added test case in `tests/services/UserService.test.js` to verify that `initializeDevAdminUser()` works correctly

**Files Modified:**
- `src/backend/database/migrations.js` - Created migration runner module with comprehensive logging and error handling
- `src/backend/server.js` - Added migration runner to startup sequence (server will fail to start if migration fails)
- `tests/services/UserService.test.js` - Added test case for `initializeDevAdminUser()`

**Migration Improvements (Latest Update):**
- Added database connection verification before running migrations (waits for DB to be ready)
- Added detailed logging at each step of the migration process with clear success/failure indicators
- Individual column checks and additions (MySQL doesn't support multiple ADD COLUMN IF NOT EXISTS in one statement)
- Post-migration verification to ensure columns were added successfully
- Server will fail to start if migration fails (prevents runtime errors from missing schema)
- Comprehensive error logging with stack traces and error codes
- Migration status written to logs at startup for debugging

**Test Coverage:**
- Added test in `tests/services/UserService.test.js` for `initializeDevAdminUser()` that verifies:
  - Admin user is created successfully
  - `toDatabaseFormat()` correctly handles optional fields
  - Method returns null in production mode

## Next Steps

1. ✅ Create a failing test that reproduces the bug (initial admin creation should succeed)
2. ✅ Fix the schema mismatch - startup migration ensures `users` table has required columns (see `migrations.js`)
3. ✅ User confirmed fixed (2026-04-01)
