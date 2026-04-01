# Startup Migration Fails: ADD COLUMN IF NOT EXISTS SQL Syntax Error

## Issue Description

On deployment (e.g. Azure App Service with Azure Database for MySQL), the application fails to start. Log stream shows the database migration step failing with a MySQL parse error.

**Error message (from log stream):**

```
Error: You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near 'IF NOT EXISTS first_name VARCHAR(100) NULL AFTER username' at line 1
```

**Failing SQL:**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL AFTER username
```

**Expected behavior:** Startup migration adds missing `users` columns (`first_name`, `last_name`, `office_location`, `is_admin`, `reset_token`, `reset_token_expiry`) when they are absent, then the server starts.

**Actual behavior:** Migration throws `ER_PARSE_ERROR` (errno 1064), migration aborts, server exits with "Database migration failed", and the site shows Application Error.

## Current Status

**Status:** Fixed - User Confirmed

**What has been tried:**

- Log stream captured on Azure; confirms all six columns reported missing and first `ADD COLUMN IF NOT EXISTS` fails with parse error.
- Root cause identified: `ADD COLUMN IF NOT EXISTS` is not supported on the MySQL server version in use (e.g. MySQL 5.7 or Azure Database for MySQL variants that do not implement this syntax). The migration already checks `information_schema` before adding columns, so `IF NOT EXISTS` in `ALTER` is redundant.

**Current state:**

- Bug logged with production log evidence.
- Code change: `src/backend/database/migrations.js` now uses `ADD COLUMN` only (no `IF NOT EXISTS`). Index creation uses plain `CREATE INDEX` with handling for duplicate key (errno 1061).
- Test: `tests/database/migrations.test.js` smoke test for `runMigrations()`.

## Investigation Tasks

1. Confirm MySQL / Azure Database for MySQL version and supported `ALTER TABLE` syntax for the deployment environment.
2. Update `src/backend/database/migrations.js` to avoid `ADD COLUMN IF NOT EXISTS` (and review `CREATE INDEX IF NOT EXISTS` for the same server version).
3. Deploy and verify log stream shows migration success and server listening.
4. Request user confirmation after production verification.

## Technical Notes

**Error type:** SQL compatibility / parse error (`ER_PARSE_ERROR`, sqlState `42000`).

**Affected code:** `src/backend/database/migrations.js` (`columnsToAdd` SQL fragments and index creation).

**Related:** Bug 0010 (missing `first_name` column); this bug is why the automated migration did not succeed on Azure despite the migration runner running.

## Fix Applied

1. Replaced `ADD COLUMN IF NOT EXISTS` with `ADD COLUMN` in `src/backend/database/migrations.js` (safe because each column is checked via `information_schema` first).
2. Replaced `CREATE INDEX IF NOT EXISTS` with `CREATE INDEX` and treat MySQL duplicate index (errno 1061) as success.

## Next Steps

1. ✅ Redeploy to Azure; migration succeeds with plain `ADD COLUMN` (log stream verified).
2. ✅ User confirmed fixed (2026-04-01); bug archived under `docs/bugs/fixed/`.
