# Admin Overtime SQL Syntax Error Bug

## Issue Description

When clicking the admin form to view overtime records, a SQL syntax error occurs. The error message indicates:

```
You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'or.*, u.username 
      FROM overtime_records or
      JOIN users u ON or.user_i' at line 1
```

**Expected Behavior:** The admin form should successfully load and display all overtime records without SQL errors.

**Actual Behavior:** A SQL syntax error occurs when attempting to load overtime records in the admin dashboard, preventing the overtime records from being displayed.

## Current Status

**Status:** Open - Investigation Needed

**What has been tried:**
- Initial investigation shows the error occurs in `OvertimeRecordRepository.js`
- The error is related to using `or` as a table alias in SQL queries

**Current State:**
- Error occurs when calling `loadAllOvertimeRecords()` function in `admin.js` (line 298)
- The API request fails with SQL syntax error
- The SQL query uses `or` as a table alias for `overtime_records`
- `or` is a MySQL reserved keyword, which causes the syntax error

**Possible Causes:**
1. The table alias `or` is a MySQL reserved keyword and needs to be escaped with backticks
2. The alias should be changed to a non-reserved keyword (e.g., `ot`, `overtime`, `overtime_rec`)
3. MySQL version-specific syntax requirements not being met

## Investigation Tasks

1. Verify the exact SQL query being executed in `OvertimeRecordRepository.js`
2. Identify all locations where `or` is used as a table alias
3. Check MySQL reserved keywords list to confirm `or` is reserved
4. Test the query with escaped alias (`\`or\``) or different alias name
5. Verify if the issue occurs in both `findByStatus()` and `findAll()` methods
6. Check if there are similar issues in other repository files

## Technical Notes

**Error Location:**
- Frontend: `src/frontend/js/admin.js` line 298 - `loadAllOvertimeRecords()` function
- Backend: `src/backend/repositories/OvertimeRecordRepository.js`
- Error occurs during API request to fetch overtime records

**Affected Methods:**
- `OvertimeRecordRepository.findByStatus()` - Line 39: `FROM overtime_records or`
- `OvertimeRecordRepository.findAll()` - Line 90: `FROM overtime_records or`

**SQL Query Pattern:**
```sql
SELECT or.*, u.username 
FROM overtime_records or
JOIN users u ON or.user_id = u.id
```

**Issue:**
- `or` is a MySQL reserved keyword (logical OR operator)
- When used as a table alias without escaping, MySQL interprets it as the OR operator, causing syntax errors
- The alias needs to be escaped with backticks: `` `or` `` or changed to a non-reserved keyword

**MySQL Reserved Keywords:**
- `or` is a reserved keyword in MySQL
- Table aliases that are reserved keywords must be escaped with backticks

## Next Steps

1. Create a failing test that reproduces the bug
2. Fix the SQL queries by either:
   - Escaping the alias with backticks: `` `or` ``
   - Changing the alias to a non-reserved keyword (e.g., `ot`, `overtime`, `overtime_rec`)
3. Update both `findByStatus()` and `findAll()` methods
4. Verify the fix works end-to-end
5. Check for similar issues in other repository files
6. Ensure all table aliases use non-reserved keywords or are properly escaped
