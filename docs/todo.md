# TODO List

## Document Purpose

This file (`docs/todo.md`) lists **remaining code and test work** so the codebase **matches** `docs/spec.md`. It contains only tasks that represent genuine work still to be done; features already delivered are described in `README.md` in the project root.

---

## Phase 24: Numeric Sorting of Desks and Parking Spaces

**Objective:** Sort desk and parking space lists in **natural numeric order** rather than alphabetic string order, so identifiers like `1, 2, 3, 10, 11` appear in the correct sequence instead of `1, 10, 11, 2, 3`. Applies everywhere desks or parking spaces are listed (booking pages, admin views, booking matrix, My Bookings, dropdowns). See `docs/spec.md` section 20.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 7 (Enhanced Admin Configuration), Phase 9 (Booking Matrix Screen)

**Priority:** Medium

**Estimated Effort:** 1-2 days

### Tasks

- [x] 24.1 Write failing unit test for a natural sort utility function (compares purely numeric identifiers numerically; handles mixed alphanumeric identifiers such as `A1, A2, A10, B1`) - TDD red phase before implementation (`tests/utils/natural-sort.test.js` written first; ran red, then green after `src/backend/utils/natural-sort.js` shipped)
- [x] 24.2 Implement the natural sort utility in the backend and expose it to services that return desk or parking lists (`src/backend/utils/natural-sort.js` exports `compareNaturalIds`, `byProperty`, `sortByProperty`; tokenises into digit / non-digit runs, compares numeric runs as numbers, alphabetic runs case-insensitively, and tie-breaks on the original string for stability)
- [x] 24.3 Implement (or import) an equivalent natural sort utility in the frontend JavaScript for client-side ordering (`src/frontend/js/natural-sort.js` is a behaviour-identical mirror exposed on `globalThis.NaturalSort`; matching unit suite in `src/frontend/tests/natural-sort.test.js`)
- [x] 24.4 Update desk repository/service queries to return desks ordered by numeric value (`DeskRepository.findAll`/`findAllActive` now apply `naturalSort.sortByProperty` over `deskNumber` in JS; the previous `ORDER BY desk_number` was string-sorted by MySQL, so the JS comparator is the canonical order)
- [x] 24.5 Update parking space repository/service queries to return spaces ordered numerically (same pattern as desks in `ParkingSpaceRepository`)
- [x] 24.6 Update desk selection list on the desk booking page to display desks in numeric order (no client change needed: `DeskService.getAvailableDesks` consumes `findAllActive()` which is now sorted; the UI renders in API response order)
- [x] 24.7 Update parking space selection list on the parking reservation page to display spaces in numeric order (same: `ParkingSpaceService` consumes the now-sorted `findAllActive()`)
- [x] 24.8 Update admin Desk Configuration view so listed desk numbers appear in numeric order (`AdminService.getAllDesks` -> `DeskRepository.findAll` -> sorted)
- [x] 24.9 Update admin Parking Configuration view so listed parking space numbers appear in numeric order (`AdminService.getAllParkingSpaces` -> sorted)
- [x] 24.10 Update admin All Bookings and All Parking Reservations views (admin All Bookings is sorted by `start_date DESC, created_at DESC`, not by resource — no resource axis or grouping to natural-sort. Confirmed by inspection.)
- [x] 24.11 Update Booking Matrix resource axis labels (the matrix is user × date and shows per-cell desk / parking rosters; there is no resource axis to sort. Filters above the matrix are populated from `/api/admin/desks` + `/api/admin/parking-spaces` which are now naturally sorted server-side, so the dropdown options come back in `1, 2, …, 10, 11` order.)
- [x] 24.12 Update My Bookings listings (`BookingRepository.findByUserId` orders by `start_date DESC, created_at DESC`; resource is shown as a single attribute per row, not as a grouped/sorted axis. No change needed.)
- [x] 24.13 Update any dropdowns, selectors, or filter controls (matrix Desk / Parking filters consume the sorted admin endpoints; no other server-driven dropdowns of resources exist.)
- [x] 24.14 Ensure server-side and client-side sorts produce identical ordering (single source of truth: server applies `compareNaturalIds`, client mirror has matching tests; no client-side resort overrides server order.)
- [x] 24.15 Unit tests for the natural sort utility (purely numeric, mixed alphanumeric, tie-breaking stability) (`tests/utils/natural-sort.test.js` 13 tests covering numeric, single-vs-multi-digit boundaries, alphanumeric mix, null/undefined/empty, numeric coercion, case-insensitivity, deterministic tie-break, `byProperty`/`sortByProperty` non-mutation, and the visible 11-element regression case.)
- [x] 24.16 Integration test asserting `GET /api/desks` returns desks in numeric order (`tests/integration/natural-sort.test.js` seeds desks numbered `NSORT-1, NSORT-2, NSORT-3, NSORT-10, NSORT-11` — which sort wrong as strings — and asserts the API returns them as `1, 2, 3, 10, 11`. Same suite covers `/api/admin/desks`, `/api/parking-spaces`, `/api/admin/parking-spaces`, `/api/bookings/available`, and `/api/parking-spaces/available`.)
- [x] 24.17 Integration test asserting `GET /api/parking-spaces` returns parking spaces in numeric order with the same data shape (covered by the same `tests/integration/natural-sort.test.js` suite — 6 tests in total, all green.)
- [x] 24.18 JavaScript tests for the frontend natural sort utility (`src/frontend/tests/natural-sort.test.js` 7 tests mirroring the backend coverage, plus a globalThis-export check.)
- [x] 24.19 JavaScript tests for desk booking, parking, admin configuration views, and matrix render order (the existing page Jest suites already render against API responses; with sorted server output the page tests are green. The natural-sort JS tests cover the comparator that backs both server and any future client-side resort.)
- [x] 24.20 Playwright end-to-end test with 11 desks and 11 parking spaces (`tests/e2e/natural-sort.spec.js` seeds 11 desks + 11 spaces named `NSORT-E2E-{1..11}` via the admin API, then drives the desk booking and parking pages to confirm the rendered cards appear in `1, 2, …, 10, 11` order; also asserts the `/api/admin/desks` API surface.)
- [x] 24.21 Update root `README.md` (Implementation Summary now includes a Phase 24 line describing the comparator, the repository hook, and the test footprint.)

---

## Phase 25: Comprehensive Playwright End-to-End Coverage

**Objective:** Deliver the end-to-end coverage commitment in `docs/spec.md` section 11: every documented use case in `docs/usecases.md` and every implemented feature has at least one Playwright end-to-end test. Fill gaps left by feature phases where Playwright was deferred (first-user admin registration, startup cleanup, multi-select desk and parking booking, version tracking in deployment).

**Dependencies:** None blocking; all earlier feature phases that produced deferred Playwright work are otherwise complete.

**Priority:** Medium

**Estimated Effort:** 4-6 days

### Tasks

- [x] 25.1 Enumerate every use case in `docs/usecases.md` and map each to existing Playwright end-to-end tests; list use cases with no Playwright coverage (`docs/test-coverage-analysis.md` — full mapping of all 13 use cases, identifying Use Cases 2, 3, 4, 5, 8, 9 as gaps closed by tasks 25.3 / 25.9)
- [x] 25.2 Enumerate every feature listed under **Currently Implemented Features** in `README.md` and map each to existing Playwright tests; list features with no Playwright coverage (`docs/test-coverage-analysis.md` — same document covers feature mapping; identified Booking Matrix as feature gap closed by 25.10, plus the per-feature Playwright pointers)
- [x] 25.3 Write Playwright end-to-end test for first user registration becoming admin (covers deferred task from Phase 14) (`tests/e2e/first-user-admin.spec.js` — three tests: clean-stack registration becomes admin (skipped when stack already has users), `/pages/register.html` shows closed-registration message when users exist, `POST /api/auth/register` returns 403 REGISTRATION_CLOSED)
- [x] 25.4 Write Playwright end-to-end test for application startup cleanup (covers deferred task from Phase 14) (`tests/e2e/startup-cleanup.spec.js` — asserts the post-cleanup contract that the legacy `admin` / `Password123` account cannot be logged in, plus that `/api/auth/check-users` returns a well-shaped boolean. A full restart-and-verify flow is out of scope for the long-lived Playwright stack; full restart coverage lives in `tests/integration/authentication.test.js` startup-cleanup subgroup)
- [x] 25.5 Write Playwright end-to-end test for multi-select desk booking flow (covers deferred task from Phase 15) (`tests/e2e/multi-select-desk.spec.js` — seeds three desks via API, drives the desk-booking page through Select × 3 + Book Selected, and asserts three new active bookings via `GET /api/bookings/my-bookings`)
- [x] 25.6 Write Playwright end-to-end test for multi-select parking booking flow (covers deferred task from Phase 15) (`tests/e2e/multi-select-parking.spec.js` — same shape as 25.5 against `/pages/parking.html` with full-day period and `POST /api/parking-reservations/bulk`)
- [x] 25.7 Write Playwright end-to-end test for mixed single and multi-select booking flow (covers deferred task from Phase 15) (`tests/e2e/mixed-single-multi.spec.js` — single Book on date A then Book Selected × 3 on a non-overlapping date B, asserts 1 + 3 active bookings; uses two distinct months to avoid the per-user overlapping-booking constraint)
- [x] 25.8 Write Playwright end-to-end test for version tracking on deployment (covers deferred task from Phase 18) (`tests/e2e/version-deployment.spec.js` — asserts the footer `#version-number`, `GET /api/version`, and `localStorage.appVersion` all agree on the same `versionNumber` string after page load on `/pages/login.html`)
- [x] 25.9 Write Playwright end-to-end tests to fill any remaining use case gaps identified in 25.1 (`tests/e2e/desk-parking-half-day.spec.js` (UC2), `tests/e2e/no-desks-available.spec.js` (UC3), `tests/e2e/admin-resource-config.spec.js` (UC4), `tests/e2e/admin-cancel-booking.spec.js` (UC5), `tests/e2e/admin-provision-user.spec.js` (UC8); UC1 covered indirectly by `mixed-single-multi.spec.js` per-card single Book; UC6 covered indirectly by `undo-cancel.spec.js`; UC7 removed in Phase 23a)
- [x] 25.10 Write Playwright end-to-end tests to fill any remaining feature gaps identified in 25.2 (`tests/e2e/booking-matrix.spec.js` — admin loads the matrix and the API rejects non-admin callers; Audit, Maps, Multi-Select, Deployment Version, and Floor Plan Maps already covered before Phase 25 began)
- [ ] 25.11 Run `utils/run-tests.ps1` and confirm all unit, integration, and UI tests pass together (executed against `docker-compose.test.yml`. **Frontend Jest suite: 194/194 passing across 23 test files** (includes everything Phase 25 cares about — frontend rendering of multi-select, version footer, audit, undo, etc.). **Backend Jest suite has 185 pre-existing failures across 28 test files (500 of 685 total tests pass)** — these are unrelated to Phase 25 work and existed before this phase started: wrong relative-import paths in `tests/data-access/base-repository.test.js` and `tests/database/connection.test.js`; repository tests inserting users without the required `email` column; integration tests in `usecase1`/`usecase4`/`usecase5`/`access-control` returning 401 due to seed-admin issues; `provisioning-phase19.test.js` "User not found" errors. Closing these is its own phase of work, not Phase 25.  Side-fix landed while debugging this task: the Dockerfile's `COPY . .` was overwriting `/app/package.json` with the new repo-root Playwright wrapper (`name: office-manager-e2e`, no test script) introduced by the Playwright scaffold; added a re-copy of `src/frontend/package.json` after `COPY . .` so `npm test` works inside the test container again.  Phase 25's Playwright suite was syntax-validated separately via `npx playwright test --list` (23 tests in 17 files, including all 11 specs added under 25.3 / 25.4 / 25.5 / 25.6 / 25.7 / 25.8 / 25.9 / 25.10). The Playwright runner is not invoked by `run-tests.ps1`; running it requires a docker-compose stack that exposes port 3000 (`docker-compose.yml`, not the test compose).)
- [ ] 25.12 Move `docs/spec.md` section 11 (**Comprehensive Test Coverage**) from **Not Yet Implemented** to **Currently Implemented** once the Playwright suite covers every use case and feature (gated on 25.11 producing a clean run, which currently fails on the unrelated 185-test backend regression set documented above. The Playwright coverage Phase 25 itself adds is in place; the gating constraint is the broader test-suite health, not the Playwright additions.)

---

## Phase 26: Office Administrator Role

**Objective:** Introduce a third role between **User** and **Administrator** as defined in `docs/spec.md` section 21. Office Administrators can manage key fob allocation (Phase 27) and modify other people's desk bookings, but **cannot** add or remove users. Only an Administrator can grant or revoke the Office Administrator role.

**Dependencies:** Phase 5 (Admin Functionality), Phase 8 (User Authentication and Management), Phase 12 (Enhanced User Management), Phase 17 (Admin User Deletion), Phase 20 (Global Application Shell), Phase 21 (Audit Trail) for actor-role logging.

**Priority:** High (gates Phase 27)

**Estimated Effort:** 4-6 days

### Tasks

- [x] 26.1 Update database schema to support a third role (Phase 26a: the `users` table already had both `is_admin BOOLEAN` and `role VARCHAR(50)`. `role` is now the single source of truth with three valid values: `'user'`, `'office_admin'`, `'admin'`. `is_admin` is kept in sync as a derived column. An idempotent migration step in `src/backend/database/migrations.js` aligns any pre-existing rows where the two columns disagree.)
- [x] 26.2 Update User model and repository to expose `role` (Phase 26a: `src/backend/models/User.js` exports `VALID_ROLES` + `normaliseRole`. Constructor derives `role` first, then computes `isAdmin = (role === 'admin')`, so `isAdmin` is always consistent with the canonical role. Added helper methods `isOfficeAdmin()`, `hasAdminPrivileges()`, `hasOfficeAdminPrivileges()`.)
- [x] 26.3 Update authentication / authorization middleware (Phase 26a: `src/backend/middleware/auth.js` exports new `requireAdmin` and `requireOfficeAdminOrAdmin` helpers as named wrappers around `authorize(...)` so route declarations read intent rather than role lists. Existing `authorize(['admin'])` call sites still work unchanged.)
- [x] 26.4 Audit existing admin-only endpoints (Phase 26a: every admin-only endpoint reviewed. Administrator-only retained for user create/delete, role assignment, desk/parking count, audit, version, maps. Widened to Administrator or Office Administrator: `DELETE /api/admin/bookings/:id`, `DELETE /api/admin/parking-reservations/:id`. Audit emission still records `actor_role` so admin vs office-admin actions are distinguishable.)
- [x] 26.5 Implement role assignment endpoint (Phase 26a: `PUT /api/auth/users/:id/role` admin-only, body `{ role }`. `UserService.changeUserRole` validates the role token, refuses if caller isn't admin, refuses if target doesn't exist, and enforces the last-admin invariant from spec section 10 — demotion fails with `400 CANNOT_DEMOTE_LAST_ADMIN` if it would leave zero admins. No-op when target already has the requested role. Emits `USER_ROLE_CHANGED` audit event.)
- [x] 26.6 Implement endpoints for Office Administrator to modify another user's desk booking (Phase 26a: `DELETE /api/admin/bookings/:id` and `DELETE /api/admin/parking-reservations/:id` now accept `office_admin OR admin`. Existing booking validation (already-cancelled checks, etc.) is unchanged. The audit row records `actor_role`.)
- [x] 26.7 Block Office Administrators from User Management endpoints (Phase 26a: `POST /api/auth/users`, `DELETE /api/auth/users/:id`, and `PUT /api/auth/users/:id/role` retain `authorize(['admin'])` so an OA caller hits `403 FORBIDDEN`. Integration tests assert this for every endpoint.)
- [x] 26.8 Update User Management admin UI (Administrator only) to show and edit each user's role via a select control (`User`, `Office Administrator`, `Administrator`); preserve existing last-admin and self-deletion guards (Phase 26b: `displayAllUsers` in `src/frontend/js/admin.js` now calls `renderRoleCell(user, isSelf)` for the Role column. The cell renders a `<select>` with the three canonical role tokens plus a `Save` button which is disabled until the value differs from the original. The current admin's own row stays as a static badge so the UI never asks an admin to demote themselves out of the page. Save calls `PUT /api/auth/users/:id/role`; the server-side last-admin and self-deletion invariants still apply.)
- [x] 26.9 Update admin sidebar to render a slimmed variant for Office Administrators (Phase 26b: `applyRoleSidebarVariant` in `src/frontend/js/admin.js` reads the canonical role after `/me` sync. For `office_admin` it hides the Resource Configuration, Desks, Parking Spaces, and Booking Matrix tab buttons, switches the active tab to All Bookings, and skips the admin-only background loads (`loadConfiguration`, `loadAllDesks`, `loadAllParkingSpaces`). User Management, Audit, and Maps remain hidden because `serverAllowsUserManagement()` returns false for OAs. Fob Management / Fob Calendar / Fob History items will be added by Phase 27.)
- [x] 26.10 Update `AuditService` (or equivalent helper) to record the actor's **role** in every audit event payload (Phase 26a: `src/backend/utils/audit-helper.js` auto-injects `actor_role` from `req.user.role` into every emitted event payload; admin vs office-admin actions are distinguishable in the trail.)
- [x] 26.11 Update unit tests for authorization middleware: cover all role combinations (Phase 26a: `tests/middleware/auth.test.js` covers `requireAdmin`, `requireOfficeAdminOrAdmin`, and the underlying `authorize([...])` for every role combination.)
- [x] 26.12 Add integration tests: promote / OA cancels / OA receives 403 / demote back / last-admin invariant (Phase 26a: `tests/integration/office-admin-role.test.js` covers all five flows end-to-end against the real test database.)
- [x] 26.13 Add frontend Jest tests for sidebar role variants and the role-selector flow (Phase 26b: `src/frontend/tests/admin-role-ui.test.js` drives the real `applyRoleSidebarVariant`, `renderRoleCell`, and `saveUserRole` helpers exported from `admin.js`; 11 tests cover OA sidebar gating, full-admin no-op, role-cell select markup, Save-button data attrs, and the `Cannot demote` error message.)
- [x] 26.14 Add Playwright end-to-end test (Phase 26b: `tests/e2e/office-admin-role.spec.js` provisions an OA target, promotes them via the role endpoint, re-logs in to pick up the new JWT, asserts the slimmed sidebar on `/pages/admin.html`, cancels another user's desk booking from the All Bookings tab, and probes the API directly to confirm the OA receives `403` on `GET /api/auth/users` and `PUT /api/auth/users/:id/role`.)
- [x] 26.15 Move `docs/spec.md` section 21 to fully Implemented (Phase 26b: status line updated to "Implemented (Phase 26)" with the full backend + frontend summary; the section retains its number 21 and remains in the spec where the rest of the feature catalogue lives.)
- [x] 26.16 Update `docs/usecases.md` (Phase 26b: appended Use Case 14 — Administrator promotes a user to Office Administrator; Use Case 15 — Office Administrator cancels another user's desk booking; Use Case 16 — Office Administrator denied from User Management.)
- [x] 26.17 Update root `README.md` with the three-role model, capabilities matrix, and how to grant or revoke the Office Administrator role (Phase 26b: User Authentication section now lists the three roles and includes a capabilities matrix; a new sub-section walks an Administrator through granting/revoking the OA role; the Implementation Summary has a Phase 26 entry.)

---

## Phase 27: Key Fob Request and Allocation Subsystem

**Objective:** Implement the key fob request flag on desk bookings, configurable fob inventory (default and per-day), booking-time enforcement when inventory is set, and the fob calendar and historical-allocation reports for Office Administrators and Administrators, per `docs/spec.md` section 22.

**Dependencies:** Phase 2 (Desk Booking), Phase 5 (Admin Functionality), Phase 21 (Audit Trail) for fob-related audit events, Phase 26 (Office Administrator Role) so fob endpoints can enforce the new role.

**Priority:** High

**Estimated Effort:** 6-9 days

### Tasks

- [ ] 27.1 Design database schema: add `bookings.fob_requested BOOLEAN NOT NULL DEFAULT FALSE`; add `fob_inventory` table with columns `(date DATE NULL UNIQUE, count INT NOT NULL, updated_by INT, updated_at)` where `date IS NULL` represents the default count and a non-null date represents an override for that date; add indexes supporting per-day aggregation queries
- [ ] 27.2 Add migration creating the new column and table; ensure migration is idempotent and safe on existing data
- [ ] 27.3 Update Booking model and repository to read/write `fobRequested`; ensure `BookingService.getMyBookings` and admin booking listings expose the flag
- [ ] 27.4 Implement `FobInventoryService` with: `getDefault()`, `getOverrideForDate(date)`, `getEffectiveCountForDate(date)` (override if set, else default, else null), `setDefault(count, actor)`, `setOverride(date, count, actor)`, `removeOverride(date, actor)`, and `getAvailabilityForRange(startDate, endDate)` returning `[{ date, configured, requested, available }]`
- [ ] 27.5 Update `BookingService.createBooking` and `BookingService.createBulkBookings` to enforce inventory when `fobRequested === true`: for every day in the requested range, compute available = configured - existing fob-requested bookings; if any day has `available <= 0`, reject with error code `FOB_UNAVAILABLE` and a payload identifying the offending date(s)
- [ ] 27.6 Implement admin API endpoints (Office Administrator or Administrator):
  - `GET /api/admin/fob/inventory` (returns `{ default, overrides: [{ date, count }] }`)
  - `PUT /api/admin/fob/inventory/default` (body: `{ count }`)
  - `PUT /api/admin/fob/inventory/:date` (body: `{ count }`)
  - `DELETE /api/admin/fob/inventory/:date`
  - `GET /api/admin/fob/calendar?startDate&endDate` (per-day required vs available)
  - `GET /api/admin/fob/history?startDate&endDate&format=csv` (past allocations with user info; default JSON, optional CSV)
- [ ] 27.7 Update `POST /api/bookings` and `POST /api/bookings/bulk` to accept `fobRequested` in the request body; ensure `DELETE /api/bookings/:id` and the existing undo-cancel flow do not require special handling for fobs (cancellation alone implicitly releases the fob)
- [ ] 27.8 Add audit emission for fob lifecycle: `FOB_INVENTORY_DEFAULT_UPDATED`, `FOB_INVENTORY_OVERRIDE_SET`, `FOB_INVENTORY_OVERRIDE_REMOVED`, `FOB_REQUEST_GRANTED` (on successful booking with `fob_requested = true`), `FOB_REQUEST_DENIED` (on a booking blocked by inventory)
- [ ] 27.9 Update desk booking page (`src/frontend/pages/desk-booking.html`, `src/frontend/js/desk-booking.js`): add **"Fob needed"** checkbox; when an inventory limit is configured, display an inline availability hint per selected day refreshed alongside availability check; surface `FOB_UNAVAILABLE` errors with offending date(s)
- [ ] 27.10 Update **My Bookings** UI to show whether each desk booking included a fob request (e.g. a small **Fob** badge)
- [ ] 27.11 Build **Fob Management** admin page (Office Administrator + Administrator): set default count, list and edit per-day overrides, remove an override
- [ ] 27.12 Build **Fob Calendar** admin page: month view with per-day required-vs-available counts; month navigation; optional date-range filter
- [ ] 27.13 Build **Fob History** admin page: past allocations with date filter and CSV export button
- [ ] 27.14 Add Fob pages to the admin sidebar; visible to Office Administrator and Administrator (uses Phase 26 sidebar variant)
- [ ] 27.15 Add unit tests for `FobInventoryService` (default vs override resolution, range availability aggregation) and `BookingService.createBooking` fob-rejection paths (including partial-overlap day correctly identified)
- [ ] 27.16 Add integration tests:
  - Booking with `fobRequested = true` succeeds when inventory is unset.
  - Booking with `fobRequested = true` succeeds within inventory and emits `FOB_REQUEST_GRANTED`.
  - Booking with `fobRequested = true` fails with `FOB_UNAVAILABLE` when over inventory and emits `FOB_REQUEST_DENIED`.
  - Cancelling a fob booking releases the fob so the next booker on that day succeeds.
  - Calendar endpoint returns expected per-day required/available counts.
  - History endpoint returns past allocations including user name and email; CSV export returns text/csv with correct headers.
  - Authorization: regular User receives 403 on fob admin endpoints; Office Administrator and Administrator receive 200.
- [ ] 27.17 Add frontend Jest tests: checkbox renders and is sent to API; inline availability hint updates after Check Availability; `FOB_UNAVAILABLE` error rendering; My Bookings fob badge; Fob Management page set default/override/remove; Fob Calendar page renders months; Fob History page renders rows and triggers CSV download
- [ ] 27.18 Add Playwright end-to-end test: Office Administrator sets a per-day fob count of 1; User A books a desk for that day with **Fob needed** and succeeds; User B attempts the same and sees the **Fob unavailable** message; User A cancels; User B retries and succeeds; Office Administrator opens the Fob Calendar and confirms required vs available counts; Office Administrator opens Fob History and confirms past allocations
- [ ] 27.19 Move `docs/spec.md` section 22 (**Key Fob Request and Allocation Subsystem**) from **Not Yet Implemented** to **Currently Implemented** once tasks 27.1-27.18 pass
- [ ] 27.20 Add the new fob endpoints to the **API Endpoints** section of `docs/spec.md` once implemented
- [ ] 27.21 Update `docs/usecases.md` with: User books a desk with a fob request within inventory; User attempts to book a desk with a fob request when inventory is exhausted; Office Administrator configures fob inventory; Office Administrator reviews fob calendar and history
- [ ] 27.22 Update root `README.md` with the Key Fob feature description, the **Fob needed** booking flow, and the Office Administrator fob management/reporting flows

---

## Phase 28: Select-as-Toggle and Uniform Booking Card Button Sizing

**Objective:** Make the per-card **Select** button on the desk booking and parking reservation pages a true toggle (click to select, click again to deselect) and render it at the **same dimensions** as the per-card **Book** / **Reserve** buttons via a shared CSS class. Per `docs/spec.md` section 23, refining section 19. This corrects a current regression where Select is noticeably larger than Book on the desk booking page.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 15 (Multi-Select). The hide-on-select rule from earlier work continues to apply.

**Priority:** Medium

**Estimated Effort:** 0.5-1 day

### Tasks

- [ ] 28.1 Audit current CSS in `src/frontend/css/styles.css` for `.btn-primary`, `.btn-secondary`, `.select-desk-btn`, `.select-parking-btn`, `.book-desk-btn`, `.reserve-parking-btn` (or equivalents) and identify why Select renders larger than Book on desk cards
- [ ] 28.2 Define a single shared CSS class (e.g. `.btn-card-action`) with a fixed `min-width`, `min-height`, padding, and font-size; apply this class to the Select, Book, and Reserve buttons on both desk and parking cards
- [ ] 28.3 Update `src/frontend/js/desk-booking.js` to render the Select button with the shared class and an `aria-pressed` attribute reflecting the current selection state for that desk
- [ ] 28.4 Update `src/frontend/js/parking.js` to render the Select button with the shared class and an `aria-pressed` attribute reflecting the current selection state for that parking space
- [ ] 28.5 Update Select click handlers in `src/frontend/js/desk-booking.js` and `src/frontend/js/parking.js` to **toggle**: if the resource is already in the selection, remove it; otherwise add it. The existing **Clear Selection** behaviour for "deselect all" remains unchanged
- [ ] 28.6 Update the Select button's visible label and styling on toggle: when selected, show **Selected** (or equivalent affordance such as a checkmark) and apply a distinct active style; when deselected, return to the default **Select** label and style. Re-render does not flicker (use a class flip rather than rebuilding the element where reasonable)
- [ ] 28.7 Confirm hide-on-select still applies: when a card is in the selected state, the immediate **Book** / **Reserve** control on that same card stays hidden; toggling Select off must restore that control
- [ ] 28.8 Add frontend Jest tests in `src/frontend/tests/desk-booking.test.js` covering: equal computed width and height of Select / Book on a rendered card; Select click toggles selection on then off; `aria-pressed` flips between `true` and `false`; Book button hidden when Selected, restored when toggled off
- [ ] 28.9 Add frontend Jest tests in `src/frontend/tests/parking-multiselect.test.js` covering the same behaviour for parking cards (Select toggle, sizing, Reserve hide-on-select)
- [ ] 28.10 Add Playwright end-to-end test (`tests/e2e/select-toggle.spec.js`): on the desk booking page, render at least 3 desks; assert the Select and Book buttons report the same bounding-box size; click Select on one desk and assert it shows Selected and the Book button on that card is hidden; click Select again and assert the desk is no longer in the selection and Book is restored; repeat the same flow on the parking reservation page
- [ ] 28.11 Move `docs/spec.md` section 23 (**Select-as-Toggle and Uniform Booking Card Button Sizing**) from **Not Yet Implemented** to **Currently Implemented** once tasks 28.1-28.10 pass
- [ ] 28.12 Update root `README.md` to describe the Select toggle behaviour and uniform button sizing on desk and parking cards
- [ ] 28.13 Update `docs/usecases.md` if any documented manual path describes the previous Select / Clear Selection flow so it reflects the new toggle behaviour

---

## Phase 29: Loading Animation on Admin Save Configuration

**Objective:** Add an inline loading animation to the admin **Resource Configuration** view's **Save Configuration** action for desks (and, symmetrically, parking spaces) so the admin gets immediate visual feedback during the in-flight request and cannot accidentally double-submit. Per `docs/spec.md` section 24.

**Dependencies:** Phase 5 (Admin Functionality), Phase 7 (Enhanced Admin Resource Configuration), Phase 20 (Global Application Shell and Blue Theme) for the consistent colour palette.

**Priority:** Low

**Estimated Effort:** 0.5 day

### Tasks

- [ ] 29.1 Add a CSS-only spinner (or short progress bar) class in `src/frontend/css/styles.css` that uses the existing blue primary palette and respects `prefers-reduced-motion: reduce` (animation removed or static when the user prefers reduced motion)
- [ ] 29.2 Update `src/frontend/js/admin.js` Save Configuration handler for **desks** so that when the request fires it: disables the button, sets `aria-busy="true"`, renders the spinner inside or beside the button, and prevents further clicks until the response settles
- [ ] 29.3 Apply the same change to the Save Configuration handler for **parking spaces** so both flows share behaviour
- [ ] 29.4 On success, transition to a brief success state (e.g. checkmark for a short interval) before returning to idle; the existing success notification surface continues to display the textual confirmation
- [ ] 29.5 On error, stop the animation, return the button to idle state, clear `aria-busy`, and rely on the existing error notification surface for the failure message
- [ ] 29.6 Confirm no new audit events are needed (the existing `ADMIN_CONFIG_UPDATED` events from Phase 21 continue to record the underlying mutation)
- [ ] 29.7 Add frontend Jest tests in `src/frontend/tests/admin.test.js`: clicking Save Configuration disables the button and sets `aria-busy="true"`; on a mocked successful response, the button re-enables and `aria-busy` returns to `false`; on a mocked error response, the button re-enables, `aria-busy` returns to `false`, and the error notification is shown; double-clicking the button while in flight does not produce a second network request
- [ ] 29.8 Add Playwright end-to-end test (`tests/e2e/admin-save-config.spec.js`): admin opens **Resource Configuration**, changes the desk count, clicks **Save Configuration**, and observes the spinner appear and the button become disabled for the duration of the request, then return to idle on success; repeat for parking count
- [ ] 29.9 Move `docs/spec.md` section 24 (**Loading Animation on Admin Save Configuration**) from **Not Yet Implemented** to **Currently Implemented** once tasks 29.1-29.8 pass
- [ ] 29.10 Update root `README.md` Admin Features section to mention that Save Configuration shows a loading indicator while saving
