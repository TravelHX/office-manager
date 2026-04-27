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

- [ ] 25.1 Enumerate every use case in `docs/usecases.md` and map each to existing Playwright end-to-end tests; list use cases with no Playwright coverage
- [ ] 25.2 Enumerate every feature listed under **Currently Implemented Features** in `README.md` and map each to existing Playwright tests; list features with no Playwright coverage
- [ ] 25.3 Write Playwright end-to-end test for first user registration becoming admin (covers deferred task from Phase 14)
- [ ] 25.4 Write Playwright end-to-end test for application startup cleanup (covers deferred task from Phase 14)
- [x] 25.5 Write Playwright end-to-end test for multi-select desk booking flow (covers deferred task from Phase 15) (`tests/e2e/multi-select-desk.spec.js` — seeds three desks via API, drives the desk-booking page through Select × 3 + Book Selected, and asserts three new active bookings via `GET /api/bookings/my-bookings`)
- [x] 25.6 Write Playwright end-to-end test for multi-select parking booking flow (covers deferred task from Phase 15) (`tests/e2e/multi-select-parking.spec.js` — same shape as 25.5 against `/pages/parking.html` with full-day period and `POST /api/parking-reservations/bulk`)
- [x] 25.7 Write Playwright end-to-end test for mixed single and multi-select booking flow (covers deferred task from Phase 15) (`tests/e2e/mixed-single-multi.spec.js` — single Book on date A then Book Selected × 3 on a non-overlapping date B, asserts 1 + 3 active bookings; uses two distinct months to avoid the per-user overlapping-booking constraint)
- [x] 25.8 Write Playwright end-to-end test for version tracking on deployment (covers deferred task from Phase 18) (`tests/e2e/version-deployment.spec.js` — asserts the footer `#version-number`, `GET /api/version`, and `localStorage.appVersion` all agree on the same `versionNumber` string after page load on `/pages/login.html`)
- [ ] 25.9 Write Playwright end-to-end tests to fill any remaining use case gaps identified in 25.1
- [ ] 25.10 Write Playwright end-to-end tests to fill any remaining feature gaps identified in 25.2
- [ ] 25.11 Run `utils/run-tests.ps1` and confirm all unit, integration, and UI tests pass together
- [ ] 25.12 Move `docs/spec.md` section 11 (**Comprehensive Test Coverage**) from **Not Yet Implemented** to **Currently Implemented** once the Playwright suite covers every use case and feature

---

## Phase 26: Office Administrator Role

**Objective:** Introduce a third role between **User** and **Administrator** as defined in `docs/spec.md` section 21. Office Administrators can manage key fob allocation (Phase 27) and modify other people's desk bookings, but **cannot** add or remove users. Only an Administrator can grant or revoke the Office Administrator role.

**Dependencies:** Phase 5 (Admin Functionality), Phase 8 (User Authentication and Management), Phase 12 (Enhanced User Management), Phase 17 (Admin User Deletion), Phase 20 (Global Application Shell), Phase 21 (Audit Trail) for actor-role logging.

**Priority:** High (gates Phase 27)

**Estimated Effort:** 4-6 days

### Tasks

- [ ] 26.1 Update database schema to support a third role: replace any existing `is_admin` boolean (or equivalent) with a `role` column accepting `USER`, `OFFICE_ADMIN`, `ADMIN`; add migration that backfills existing admins to `ADMIN` and all other users to `USER`
- [ ] 26.2 Update User model and repository to expose `role` (replacing `isAdmin` where applicable while keeping a derived `isAdmin` accessor for backwards compatibility during the transition)
- [ ] 26.3 Update authentication / authorization middleware to recognise the three roles; add helpers such as `requireAdmin`, `requireOfficeAdminOrAdmin`, `requireAuthenticated`
- [ ] 26.4 Audit existing admin-only endpoints and split them into **Administrator only** (user create, user delete, role assignment, desk count, parking count, version config, audit retention) vs **Administrator or Office Administrator** (modify another user's desk booking) per spec section 21
- [ ] 26.5 Implement role assignment endpoint: `PUT /api/admin/users/:id/role` (Administrator only) accepting `{ role: 'USER' | 'OFFICE_ADMIN' | 'ADMIN' }`; reject self role changes that would violate existing self-protection rules; reject the change if it would leave the system without an Administrator (per section 10 invariant)
- [ ] 26.6 Implement endpoints (or extend existing ones) for an Office Administrator to **modify another user's desk booking**: at minimum an admin-style `DELETE /api/admin/bookings/:id` and update path; ensure server enforces existing booking validation rules
- [ ] 26.7 Block Office Administrators from User Management endpoints (`POST /api/auth/users`, `DELETE /api/users/:id`, role assignment) returning 403 with a clear error code such as `FORBIDDEN_ROLE`
- [ ] 26.8 Update User Management admin UI (Administrator only) to show and edit each user's role via a select control (`User`, `Office Administrator`, `Administrator`); preserve existing last-admin and self-deletion guards
- [ ] 26.9 Update admin sidebar to render a slimmed variant for Office Administrators: visible items limited to **Fob Management**, **Fob Calendar**, **Fob History** (added in Phase 27), and **Bookings** (with edit/cancel for any user); hide User Management, Resource Configuration, Audit, Maps, and other Administrator-only sections
- [ ] 26.10 Update `AuditService` (or equivalent helper) to record the actor's **role** in every audit event payload so admin vs office-admin actions are distinguishable in the trail
- [ ] 26.11 Update unit tests for authorization middleware: cover all role combinations against representative endpoint helpers
- [ ] 26.12 Add integration tests: Administrator can promote a user to Office Administrator; Office Administrator can cancel another user's desk booking; Office Administrator receives 403 on user-create, user-delete, and role-assignment endpoints; an Administrator can demote an Office Administrator back to User; minimum-one-admin invariant still blocks demoting the last Administrator
- [ ] 26.13 Add frontend Jest tests asserting that a session with `role = OFFICE_ADMIN` renders the slimmed sidebar (no User Management, no Resource Configuration), and that a session with `role = ADMIN` renders the full sidebar
- [ ] 26.14 Add Playwright end-to-end test: Administrator promotes a user to Office Administrator; the promoted user logs in, sees the slimmed admin sidebar, cancels another user's desk booking successfully, and is denied (403 / no UI access) when attempting to open User Management
- [ ] 26.15 Move `docs/spec.md` section 21 (**Office Administrator Role**) from **Not Yet Implemented** to **Currently Implemented** once tasks 26.1-26.14 pass
- [ ] 26.16 Update `docs/usecases.md` with: Administrator promotes a user to Office Administrator; Office Administrator modifies another user's desk booking; Office Administrator denied from user management
- [ ] 26.17 Update root `README.md` with the three-role model, capabilities matrix, and how to grant or revoke the Office Administrator role

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
