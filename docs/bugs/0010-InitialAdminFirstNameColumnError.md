# Initial Admin Creation - Unknown Column 'first_name' Bug

## Issue Description

When creating the initial admin user, the following error occurs:

```
Unknown column 'first_name' in 'field list'
```

**Expected Behavior:** The initial admin user should be created successfully without database errors.

**Actual Behavior:** A database error occurs indicating that the `first_name` column does not exist in the target table.

## Current Status

**Status:** Open - Not Yet Investigated

**What has been tried:**
- None

**Current State:**
- Bug reported by user
- No investigation or fix attempts yet

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

## Next Steps

1. Create a failing test that reproduces the bug (initial admin creation should succeed)
2. Fix the schema mismatch - either add the column, rename it, or update the query to match the schema
3. Verify the fix and request user confirmation
