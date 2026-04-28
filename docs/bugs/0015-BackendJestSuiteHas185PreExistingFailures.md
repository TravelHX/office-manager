# Backend Jest Suite Has 185 Pre-Existing Failures

## Issue Description

`utils/run-tests.ps1` cannot complete cleanly because the backend Jest suite
fails 185 of 685 tests across 28 of 56 test files. The failures pre-date
Phase 25 and are not caused by the Playwright work added there; they have
been visible in two separate Phase 25 run-tests.ps1 attempts (April 24 and
April 28).

The frontend Jest suite is unaffected (194/194 passing across 23 files).

**Expected behavior:** `utils/run-tests.ps1` exits 0 with both backend and
frontend suites green, satisfying `docs/todo.md` task 25.11 and unblocking
25.12 (move `docs/spec.md` section 11 to **Currently Implemented**).

**Actual behavior:** `utils/run-tests.ps1` exits 1 because the backend
Jest run reports 185 failed tests. The failures fall into clearly
distinguishable buckets (see Technical Notes), suggesting independent
fixes rather than a single root cause.

## Current Status

**Status:** Open

**What has been tried:**

1. April 24 run (Phase 25 setup work): backend Jest exit code 1, 215
   failed tests; UI Jest 157/157 passing. The numbers were higher because
   Phase 24 (natural sort) tests had not been merged yet.
2. April 28 run (Phase 25 wrap-up): backend Jest exit code 1, 185 failed
   tests; UI Jest 194/194 passing. The reduction came from Phase 24's
   merge adding green tests, not from any failure being fixed.
3. Side-fix during the April 28 run: the Dockerfile's `COPY . .` was
   overwriting `/app/package.json` with the new repo-root Playwright
   wrapper (`name: office-manager-e2e`, no `test` script), so `npm test`
   inside the test container failed before any Jest test ran. Added a
   re-copy of `src/frontend/package.json` after `COPY . .` so the
   application package.json (with the test script and runtime deps) is
   restored. **This fix is in place and is what allowed the 185 failures
   to surface in the first place** — without it, backend tests fail
   instantly with `Missing script: "test"`.
4. No backend Jest test failure has been investigated or fixed yet under
   this ticket.

## Investigation Tasks

1. Fix wrong relative-import paths in `tests/data-access/base-repository.test.js`
   and `tests/database/connection.test.js`. Both files use
   `require('../src/backend/...')` (one `..`), which from
   `tests/data-access/` and `tests/database/` resolves to
   `tests/src/backend/...` (does not exist). Should be `../../src/backend/...`.
2. Make `tests/integration/admin-functionality.test.js` actually contain
   at least one `test()` (Jest fails the suite with "Your test suite must
   contain at least one test" today). Decide whether to delete the empty
   file or fill it with the admin coverage that was clearly intended.
3. Update repository tests that `INSERT INTO users (id, username,
   password_hash, is_admin) VALUES (...)` to include the `email` column
   (or rely on a helper). Affected files include
   `tests/repositories/UserRepository.test.js`,
   `tests/repositories/ParkingReservationRepository.test.js`, and
   `tests/repositories/OvertimeRecordRepository.test.js` (the last is
   stale code from before Phase 23a's overtime removal — confirm whether
   the file should be deleted or updated). The schema has had `email NOT
   NULL` for several phases; these tests were authored against the older
   schema.
4. Update `tests/repositories/DeskRepository.test.js` and
   `tests/repositories/ParkingSpaceRepository.test.js` to:
   - Pass `null` (not `undefined`) for optional bind parameters; mysql2
     rejects `undefined` with `Bind parameters must not contain undefined`.
   - Use the snake_case column names the repositories actually expose
     (`desk_number`, not `deskNumber`) — at minimum verify the test data
     matches the model's `toDatabaseFormat`.
5. Audit the integration tests that consistently return 401:
   `tests/integration/usecase1-two-day-booking.test.js`,
   `tests/integration/usecase4-admin-config.test.js`,
   `tests/integration/usecase5-admin-cancel-booking.test.js`,
   `tests/integration/access-control.test.js`,
   `tests/integration/overtime-tracking.test.js`. The pattern is the
   admin / user seed not being set up before the first authenticated
   request fires, so Bearer tokens are stale. Likely a shared
   `beforeAll` helper missing or an order-of-import issue similar to the
   "server.js auto-startup vs jest.mock" race that was fixed for
   UserService.test.js.
6. Investigate `tests/integration/provisioning-phase19.test.js` — every
   test fails with `User not found` from `getUserByUsername`. Probably
   the same seed-admin issue as task 5, but the test path goes through
   `provision/validate` rather than login.
7. Investigate `tests/utils/deployment-config.test.js`:
   - `readDeploymentVersion reads and normalizes deployment_info.version`
     expects `2.1.0.0` but gets `1.0.0.0` — the test seems to have hard-
     coded an expected value that no longer matches `data/config.json`.
   - `writeDeploymentVersion merges deployment_info and normalizes`
     errors with `config.json not found at /app/data/config.json` — the
     test container has `data/` mounted but the test is running in a
     CWD where the relative path does not resolve. Either fix the test
     to use `process.cwd()` correctly or guarantee the working directory
     before the test runs.
8. After each cluster (1, 2, 3, 4, 5+6, 7) is fixed, run
   `utils/run-tests.ps1` and confirm the failure count drops by the
   expected amount before moving to the next cluster.
9. Once `utils/run-tests.ps1` exits 0, close `docs/todo.md` task 25.11
   and proceed with 25.12 (move `docs/spec.md` section 11 to **Currently
   Implemented**).

## Technical Notes

**Failure breakdown (from the April 28 run):**

| Bucket | Suites | Approx tests | Symptom |
|---|---|---|---|
| Wrong import paths | 2 | 2 (suite-load failures) | `Cannot find module '../src/backend/...'` |
| Empty test suite | 1 | 1 (suite-load failure) | `Your test suite must contain at least one test` |
| Repository INSERT missing email | 3 | ~25 | `Field 'email' doesn't have a default value` |
| Repository undefined / wrong column | 2 | ~10 | `Bind parameters must not contain undefined`, `Unknown column 'deskNumber'` |
| Integration tests with stale auth | 5 | ~80 | `Expected: 200/201, Received: 401` |
| `provisioning-phase19.test.js` | 1 | ~3 | `User not found` from `getUserByUsername` |
| `deployment-config.test.js` | 1 | ~2 | hard-coded version mismatch + missing `config.json` path |
| Misc service tests with stale mocks (UserService) | 1 | ~50 | mocks not wiring; partially addressed earlier but worth re-checking |
| Other (residual) | varies | balance to 185 | mixed; likely cascade from above |

The April 24 run hit similar buckets but with 215 failures because:
- Phase 24 (natural sort) tests had not been merged, so the test count
  was lower and pass count was lower.
- Phase 23a's overtime removal had not been merged in some forks, so
  `OvertimeService.test.js` etc. were still present and failing.

**Why this is not a Phase 25 regression:** Phase 25 added 11 Playwright
spec files in `tests/e2e/`. None of those files run under
`utils/run-tests.ps1` — the script invokes Jest only. Phase 25 added
zero Jest tests, modified zero source files under `src/backend`, and
modified zero Jest tests under `tests/` outside the e2e folder.

**Out of scope for this ticket:** writing or modifying any Phase 25
Playwright spec; modifying `utils/run-tests.ps1` to invoke the
Playwright runner; moving `docs/spec.md` section 11 (this is the
follow-up after 25.11 closes, tracked under todo.md task 25.12).

## Next Steps

1. Tackle the buckets in Investigation Tasks order; each bucket is a
   self-contained fix that does not depend on the others.
2. After each bucket, run `utils/run-tests.ps1` and confirm failures
   dropped by the expected count. Do not batch all buckets together —
   small, verifiable steps make it easier to spot a regression.
3. When the backend Jest suite reaches 0 failures, run
   `utils/run-tests.ps1` end-to-end one more time, confirm exit code 0,
   and update `docs/todo.md` 25.11 with the green-run details.
4. Then proceed to 25.12 in a separate change set.
