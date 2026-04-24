# Phase 23a Technical Notes: Overtime Removal Strategy

## Decision

The overtime feature is removed end-to-end. The `overtime_records` table and all
related code, routes, UI, tests, and documentation are deleted. No in-product
archival shim (read-only listing, export endpoint, etc.) is retained. The
product scope no longer includes overtime; see `docs/spec.md` sections 1 and 16.

## Data handling

`overtime_records` is dropped as part of the schema change. Historical rows are
not migrated into another table. Operators who want a historical record of
submitted overtime must take a database backup before upgrading past this
phase. The recommended command against a development database is:

```
docker exec office-manager-mysql \
    mysqldump -uoffice_user -poffice_password office_manager overtime_records \
    > overtime_records_backup.sql
```

Against production the operator should use their standard backup tooling; the
table is small (one row per submission) and the schema is documented in the
removed `src/sql/05-overtime-schema.sql` in git history.

## Foreign keys

`overtime_records` referenced `users(id)` via:

- `user_id` — `ON DELETE CASCADE`
- `approved_by` — `ON DELETE SET NULL`

No other table referenced `overtime_records`, so dropping the table leaves no
dangling references.

## Implementation surface

The removal spans four areas; each is a single sweep rather than a staged
rollout:

1. **Database**: delete `src/sql/05-overtime-schema.sql` (runs only on fresh
   Docker init) and add a drop step to `src/backend/database/migrations.js` so
   existing environments drop the table on next startup.
2. **Backend**: delete the overtime model, repository, service, route; remove
   references from `routes/index.js`, `routes/admin.js`, `services/AdminService.js`,
   `services/UserService.js`.
3. **Frontend**: delete `overtime.html` and `overtime.js`; prune dashboard and
   bookings cards, sidebar links, admin tab, matrix references, and the
   top-of-page description in `index.html`.
4. **Tests**: delete overtime-only suites; prune overtime branches from mixed
   suites (`usecase7`, `access-control`, `admin-user-deletion`,
   `user-creation-form`, `UserRepository`, `docs-roadmap`, `auth-state`).

The audit event catalogue (`docs/audit-events.md`) drops overtime actions. The
spec retains section 16 (the removal announcement itself) until the delivery is
recorded, then section 16 is rewritten as a brief note that the feature was
removed in Phase 23a.

## Verification

- `grep -i overtime` across `src/`, `tests/`, `docs/`, `README.md` returns zero
  results after the phase completes (aside from this note and phase/history
  markers in `docs/todo.md`).
- `utils/run-tests.ps1` passes all unit, integration, and UI tests.
- `GET /api/overtime/*` returns 404 (route is gone).
- The application starts cleanly against a database that previously contained
  `overtime_records`; the migration's drop step is idempotent.
