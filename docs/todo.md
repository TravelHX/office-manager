# TODO List

## Document Purpose

This file (`docs/todo.md`) lists **remaining tasks** so the codebase and product **match** `docs/spec.md`. Completing these tasks (in order, respecting dependencies) moves the project toward the intended functionality described in the specification. It is not the specification itself; see `docs/spec.md`. For what is **already implemented**, see `README.md` in the project root.

---

## Phase 14: First User Admin Registration (Remaining Tasks)

**Objective:** Complete testing, validation, and registration-blocking logic for first user admin registration system.

**Dependencies:** Phase 8 (User Authentication and Management), Phase 12 (Enhanced User Management)

**Priority:** High

**Estimated Effort:** 1-2 days

### Tasks

- [x] 14.24 Write integration tests for application startup cleanup removing admin/password123 user
- [x] 14.25 Write integration tests for application startup cleanup flushing users when admin user exists
- [x] 14.26 Write JavaScript tests for registration screen when no users exist
- [x] 14.27 Write JavaScript tests for routing to registration when no users exist
- [ ] 14.28 Write end-to-end test for first user registration becoming admin (Playwright; deferred where Playwright is not in CI; API-level end-to-end coverage exists in `tests/integration/authentication.test.js`)
- [ ] 14.29 Write end-to-end test for application startup cleanup (Playwright; deferred where Playwright is not in CI; API-level end-to-end coverage exists in `tests/integration/authentication.test.js`)
- [x] 14.30 Validate that first user to register becomes admin automatically
- [x] 14.31 Validate that registration screen appears when no users exist
- [x] 14.32 Validate that admin/password123 user is removed automatically when application starts
- [x] 14.33 Validate that all users are flushed automatically when admin user exists at application startup
- [x] 14.34 Validate that subsequent users do not automatically become admin
- [x] 14.35 Block registration when users already exist: registration API endpoint must return an error (e.g. 403) when at least one user exists; UI must not show the registration form and instead display a message directing the visitor to log in or contact an administrator to be provisioned (spec section 4b: "When any user already exists, self-registration is not available")
- [x] 14.36 Write integration test: POST /api/auth/register returns error when users already exist in the system
- [x] 14.37 Write JavaScript test: registration page shows informational message and no form when users already exist

---

## Phase 15: Multi-Select Desk and Parking Booking (Remaining Tasks)

**Objective:** Complete end-to-end testing and validation for multi-select booking functionality.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 13 (Availability Display Enhancement)

**Priority:** Medium

**Estimated Effort:** 1-2 days

### Tasks

- [ ] 15.34 Write end-to-end test for multi-select desk booking flow
- [ ] 15.35 Write end-to-end test for multi-select parking booking flow
- [ ] 15.36 Write end-to-end test for mixed single and multi-select booking
- [ ] 15.37 Validate that users can select multiple desks and book them all at once
- [ ] 15.38 Validate that users can select multiple parking spaces and book them all at once
- [ ] 15.39 Validate that existing single "Book" button still works correctly
- [ ] 15.40 Validate that selection persists correctly during scrolling

---

## Phase 17: Admin User Deletion (Remaining Tasks)

**Objective:** Implement self-deletion prevention so admins cannot delete their own account, per spec sections 4a and 10.

**Dependencies:** Phase 8 (User Authentication and Management), Phase 12 (Enhanced User Management)

**Priority:** Medium

**Estimated Effort:** 1-2 days

### Tasks

- [x] 17.35 Implement self-deletion prevention: API must reject DELETE /api/users/:id when `:id` is the currently authenticated admin, regardless of how many admins exist (spec sections 4a and 10 require this as a rule separate from the last-admin invariant)
- [x] 17.36 Update admin user management UI to hide or disable the delete button on the current user's own row
- [x] 17.37 Create clear error message for self-deletion attempt ("You cannot delete your own account; another administrator must perform this action")
- [x] 17.38 Write integration test: admin with multiple other admins still cannot delete themselves (returns 400/403 with descriptive error)
- [x] 17.39 Write JavaScript test: delete button is not rendered or is disabled for the current user's own entry in the user list

---

## Phase 18: Version Tracking and Management (Remaining Tasks)

**Objective:** Complete end-to-end testing and validation for version tracking system.

**Dependencies:** Phase 1 (Project Setup and Infrastructure)

**Priority:** Medium

**Estimated Effort:** 1 day

### Tasks

- [ ] 18.27 Write end-to-end test for version tracking on deployment
- [ ] 18.28 Validate that version increments correctly on each commit/deployment
- [ ] 18.29 Validate that version is updated in database on application startup
- [ ] 18.30 Validate that error is displayed if version update fails
- [ ] 18.31 Validate that version is stored in client config
- [ ] 18.32 Validate that version follows semantic versioning format

---

## Phase 20: Global Application Shell and Blue Theme (Remaining Tasks)

**Objective:** Complete frontend test adjustments for the global application shell.

**Dependencies:** None (frontend layout and styles)

**Priority:** Medium

**Estimated Effort:** 1-2 days

### Tasks

- [x] 20.10 Adjust remaining frontend tests (streamlined-booking, auth pages, admin, availability-display, parking, bookings, matrix, etc.) for `globalThis.apiRequest` wrappers and updated DOM; `npm test` in `src/frontend` now runs all 20 suites (145 tests) green

---

## Phase 21: Administrative Audit Trail

**Objective:** Provide an **admin-only Audit** section and **append-only audit log** of meaningful actions by **all users** (including admins), with a **simple search** for administrators.

**Dependencies:** Phase 5 (Admin Functionality), Phase 8 (User Authentication and Management), Phase 20 (application shell) for consistent admin navigation.

**Priority:** High

**Estimated Effort:** 6-10 days

**Note on overtime:** Phase 23 removes the overtime feature. Task 21.9 wires audit events for overtime, but that code will be immediately removed in Phase 23. To avoid throwaway work, either **skip overtime audit wiring** in this phase (omit task 21.9) and note it as N/A once overtime is removed, or **complete Phase 23 overtime removal first** before building the audit trail. The chosen approach should be recorded here when work begins.

### Tasks

- [ ] 21.1 Finalize event type catalog and field list from `docs/spec.md` section 15; list each HTTP route or service method that must emit an event
- [ ] 21.2 Design database schema for audit events (table name, columns, indexes for time, actor_user_id, action_type, full-text or composite strategy for search)
- [ ] 21.3 Add migration creating audit table; document retention approach (default unlimited or documented cap)
- [ ] 21.4 Implement AuditEvent model and repository (append-only insert; admin-only list/search with parameterized queries)
- [ ] 21.5 Implement AuditService (or equivalent) to record events with consistent shape; add helper used by routes/services
- [ ] 21.6 Wire audit emission for **authentication**: login success, logout (and failed login if included)
- [ ] 21.7 Wire audit emission for **desk bookings**: create, user cancel, admin cancel
- [ ] 21.8 Wire audit emission for **parking**: create reservation, user cancel, admin cancel
- [ ] 21.9 Wire audit emission for **overtime**: create, update, delete; admin approve/reject if present in codebase
- [ ] 21.10 Wire audit emission for **admin configuration** and **desk/parking admin** operations (counts, numbering, matrix-triggered changes if any)
- [ ] 21.11 Wire audit emission for **user management** (create, delete, password change, profile completion) for both self-service and admin paths
- [ ] 21.12 Wire audit emission for **bulk booking** and any other mutating flows not yet covered
- [ ] 21.13 Implement `GET /api/admin/audit-events` (admin only): pagination, `search` query matching documented fields; return safe JSON (no secrets)
- [ ] 21.14 Add **Audit** item to admin UI (sidebar); build page or tab with table and **search box**; restrict visibility to admins
- [ ] 21.15 Add unit tests for AuditService and repository (append-only, search behavior)
- [ ] 21.16 Add integration tests for audit API (403 for non-admin, 200 with events for admin, search returns expected rows)
- [ ] 21.17 Add integration or frontend tests proving representative actions create audit rows
- [ ] 21.18 Add Playwright end-to-end test: admin opens Audit, searches, sees expected event after a seeded action
- [ ] 21.19 Update `docs/spec.md` API section with implemented audit endpoints; move section 15 to **Currently Implemented** when done
- [ ] 21.20 Update root `README.md` User Guide (admin: Audit section) after implementation
- [ ] 21.21 Update `docs/usecases.md` with admin audit review and search flow

---

## Phase 22: Config-driven Deployment Version and Release History (Remaining Tasks)

**Objective:** Complete Playwright end-to-end testing for deployment version and release history.

**Dependencies:** Phase 18 (version APIs and footer display)

**Priority:** Medium

**Estimated Effort:** 0.5 day

### Tasks

- [ ] 22.9 Add Playwright end-to-end test: footer version link opens release history and content loads (deferred where Playwright is not in CI)

---

## Phase 23: Remove Overtime; Floor Plan Maps; Undo Cancel; Booking Button UX

**Objective:** Align the product with `docs/spec.md` **Not Yet Implemented** sections **16--19**: remove overtime end-to-end; add **square** desk and carpark **map** UIs with **admin-uploaded** PNG/JPG floor plans and **admin-only** landmark editing (landmarks non-blocking for resource clicks); **Undo** after user desk cancel within a short window; **uniform** Select / Book / Reserve / Book selected button sizing and **hide immediate Book/Reserve** when that resource is in the multi-select selection.

**Dependencies:** Phase 2 (desk), Phase 3 (parking), Phase 5 (admin), Phase 15 (multi-select) as implemented today; Phase 20 (shell) for navigation changes.

**Priority:** High (UX and scope change)

**Estimated Effort:** 10-18 days (depends on map editor depth and migration choice for overtime data)

### Tasks

- [ ] 23.1 Finalize overtime removal strategy: drop vs archive `overtime_records`; document operator backup expectations in technical notes
- [ ] 23.2 Remove overtime API routes, services, middleware references, and integration tests; adjust OpenAPI or spec tables if present
- [ ] 23.3 Remove overtime frontend: `overtime.html`, scripts, dashboard cards, My Bookings overtime section, admin overtime UI, matrix overtime hooks, sidebar/footer links; update `main.js` protected routes and shell
- [ ] 23.4 Database migration: remove or archive overtime table and foreign keys; remove overtime seed data from SQL init scripts used by Docker/tests
- [ ] 23.5 Update auth / profile-complete restrictions and audit trail spec implementation (when built) to drop overtime event types; grep codebase for `overtime` and clean remaining references
- [ ] 23.6 Design map data model: per-context floor plan image path, image version, landmark list (type, optional label, normalized x/y), desk and parking space map coordinates; document in `docs/spec.md` API subsection when endpoints exist
- [ ] 23.7 Admin API: secure upload for desk and parking floor plans (PNG/JPG only, size limit); GET map configuration for each context; admin CRUD for landmarks and for resource coordinates
- [ ] 23.8 Admin UI: map editor (square viewport) to upload/replace image, place or adjust desk/parking markers, add/edit/delete landmarks (preset types + custom label)
- [ ] 23.9 Desk booking UI: square map panel alongside or above list; sync selection/booking state with list; keyboard/fallback documented
- [ ] 23.10 Parking UI: square map panel for carpark selection consistent with desk patterns
- [ ] 23.11 Desk cancel **Undo**: implement server rule (time window + availability check) and client banner/toast with Undo; unit tests for service rules
- [ ] 23.12 Booking buttons: shared CSS/component for consistent dimensions; hide per-item Book/Reserve when item is selected; update desk and parking pages and frontend tests
- [ ] 23.13 Integration tests: map config endpoints (admin auth, file upload), undo cancel happy path and expiry, booking list still works without map if no image configured
- [ ] 23.14 Frontend Jest tests: map rendering with mock config, button visibility when selected, undo UI
- [ ] 23.15 Playwright end-to-end test: admin uploads plan and places landmark; user sees map on desk or parking page; user cancels desk and undoes within window
- [ ] 23.16 Update `docs/usecases.md`: remove overtime flows; add map orientation and undo flows; update multi-select manual paths for buttons
- [ ] 23.17 Update root `README.md` (remove overtime user guide; document maps, undo, button behavior)
- [ ] 23.18 Update `docs/spec.md` **Currently Implemented** and API lists after delivery; mark Phase 23 tasks complete in this file

---

## Phase 24: Numeric Sorting of Desks and Parking Spaces

**Objective:** Sort desk and parking space lists in **natural numeric order** rather than alphabetic string order, so identifiers like `1, 2, 3, 10, 11` appear in the correct sequence instead of `1, 10, 11, 2, 3`. Applies everywhere desks or parking spaces are listed (booking pages, admin views, booking matrix, My Bookings, dropdowns). See `docs/spec.md` section 20.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 7 (Enhanced Admin Configuration), Phase 9 (Booking Matrix Screen)

**Priority:** Medium

**Estimated Effort:** 1-2 days

### Tasks

- [ ] 24.1 Write failing unit test for a natural sort utility function (compares purely numeric identifiers numerically; handles mixed alphanumeric identifiers such as `A1, A2, A10, B1`) - TDD red phase before implementation
- [ ] 24.2 Implement the natural sort utility in the backend and expose it to services that return desk or parking lists
- [ ] 24.3 Implement (or import) an equivalent natural sort utility in the frontend JavaScript for client-side ordering
- [ ] 24.4 Audit all backend SQL queries and service methods that return desks or parking spaces (repositories, booking availability, admin listings, matrix aggregation) and document which need numeric ordering
- [ ] 24.5 Update desk repository/service queries to return desks ordered by numeric value of the desk number (e.g. SQL `ORDER BY CAST(number AS UNSIGNED), number` or equivalent natural sort) with stable secondary ordering
- [ ] 24.6 Update parking space repository/service queries to return spaces ordered numerically with stable secondary ordering
- [ ] 24.7 Update desk selection list on the desk booking page to display desks in numeric order
- [ ] 24.8 Update parking space selection list on the parking reservation page to display spaces in numeric order
- [ ] 24.9 Update admin Desk Configuration view so listed desk numbers appear in numeric order
- [ ] 24.10 Update admin Parking Configuration view so listed parking space numbers appear in numeric order
- [ ] 24.11 Update admin All Bookings and All Parking Reservations views (where grouped or sorted by resource number) to use numeric order
- [ ] 24.12 Update Booking Matrix resource axis labels (desks and parking) to appear in numeric order
- [ ] 24.13 Update My Bookings listings (desk bookings and parking reservations) so resources appear in numeric order
- [ ] 24.14 Update any dropdowns, selectors, or filter controls that list desks or parking spaces to use the same numeric order
- [ ] 24.15 Ensure server-side and client-side sorts produce identical ordering (no mixed strategies across views)
- [ ] 24.16 Write unit tests for the natural sort utility covering: purely numeric identifiers, mixed alphanumeric identifiers, tie-breaking stability
- [ ] 24.17 Write integration test asserting `GET /api/desks` returns desks in numeric order when desks include numbers that would sort incorrectly as strings (e.g. 1, 2, 10, 11)
- [ ] 24.18 Write integration test asserting `GET /api/parking-spaces` returns parking spaces in numeric order with the same data shape
- [ ] 24.19 Write JavaScript tests for the frontend natural sort utility
- [ ] 24.20 Write JavaScript tests asserting the desk booking page, parking reservation page, admin configuration views, and booking matrix render resources in numeric order given mixed-magnitude fixtures
- [ ] 24.21 Write Playwright end-to-end test: with at least 11 desks and 11 parking spaces configured, verify the booking pages, admin views, and booking matrix all display resource numbers in natural numeric order
- [ ] 24.22 Validate that all documented surfaces (desk booking, parking, admin desks, admin parking, admin bookings, admin parking reservations, booking matrix, My Bookings, dropdowns) display resources in natural numeric order
- [ ] 24.23 Update `docs/usecases.md` if any documented manual path references a specific ordering of desks or parking spaces
- [ ] 24.24 Update root `README.md` once implemented to reflect that resource lists are presented in natural numeric order

---

## Phase 25: Enhanced Desk Display Verification and Documentation

**Objective:** Confirm that desk numbers are displayed prominently in user-facing flows (desk booking list, booking success feedback, My Bookings) per `docs/spec.md` section 2, close any gaps with tests, and move the specification section from **Not Yet Implemented** to **Currently Implemented**.

**Dependencies:** Phase 2 (Desk Booking), Phase 7 (Enhanced Admin Resource Configuration)

**Priority:** Low

**Estimated Effort:** 0.5-1 day

### Tasks

- [ ] 25.1 Audit desk booking page (`src/frontend/pages/desk-booking.html` and `src/frontend/js/desk-booking.js`) to confirm each available desk renders its desk number prominently (heading or strong emphasis)
- [ ] 25.2 Audit booking success feedback (notification/toast after booking) to confirm the desk number appears in the success message; add it if missing
- [ ] 25.3 Audit My Bookings page (`src/frontend/js/bookings.js`) to confirm each desk booking row shows the desk number prominently
- [ ] 25.4 Write JavaScript test asserting the desk booking list renders `Desk <number>` for each available desk returned by the API
- [ ] 25.5 Write JavaScript test asserting the success notification after booking includes the desk number
- [ ] 25.6 Write JavaScript test asserting My Bookings desk rows render the desk number
- [ ] 25.7 Update root `README.md` under **Desk Booking** to mention that desk numbers are shown prominently in the list, success message, and My Bookings
- [ ] 25.8 Move `docs/spec.md` section 2 (**Enhanced Desk Display**) from **Not Yet Implemented** into the appropriate **Currently Implemented** phase narrative once tasks 25.1-25.6 pass

---

## Phase 26: Admin Desk Number Display Verification and Documentation

**Objective:** Confirm that desk numbers are displayed in admin surfaces (admin dashboard desk configuration, admin booking management, admin desk listing) per `docs/spec.md` section 3, close any gaps with tests, and move the specification section from **Not Yet Implemented** to **Currently Implemented**.

**Dependencies:** Phase 5 (Admin Functionality), Phase 7 (Enhanced Admin Resource Configuration)

**Priority:** Low

**Estimated Effort:** 0.5-1 day

### Tasks

- [ ] 26.1 Audit admin desk configuration view (`src/frontend/js/admin.js` and `src/frontend/pages/admin.html`) to confirm all allocated desk numbers are listed
- [ ] 26.2 Audit admin booking management view to confirm desk number is displayed for each booking row
- [ ] 26.3 Audit admin desk listing (when viewing desk configuration details) to confirm desk numbers are shown next to each desk entry
- [ ] 26.4 Write JavaScript test asserting admin desk configuration renders the full list of allocated desk numbers
- [ ] 26.5 Write JavaScript test asserting admin booking management rows display the desk number
- [ ] 26.6 Update root `README.md` under **Admin Dashboard** to state that allocated desk numbers are visible in the configuration view and booking management view
- [ ] 26.7 Move `docs/spec.md` section 3 (**Admin Desk Number Display**) from **Not Yet Implemented** into the appropriate **Currently Implemented** phase narrative once tasks 26.1-26.5 pass

---

## Phase 27: Comprehensive Test Coverage Audit

**Objective:** Deliver the cross-cutting commitment in `docs/spec.md` section 11: every documented use case in `docs/usecases.md` and every implemented feature has at least one end-to-end test (Playwright) and feasible unit coverage, with gaps identified and filled.

**Dependencies:** All feature phases implementing the behaviors being tested. Most naturally run after Phase 23 (overtime removal) so test coverage is not written against code slated for deletion.

**Priority:** Medium

**Estimated Effort:** 5-8 days

### Tasks

- [ ] 27.1 Enumerate every use case in `docs/usecases.md` and map each to existing Playwright end-to-end tests; list use cases with no end-to-end coverage
- [ ] 27.2 Enumerate every feature listed under **Currently Implemented Features** in `README.md` and map each to existing end-to-end tests; list features with no end-to-end coverage
- [ ] 27.3 Enumerate every backend service, repository, and route handler and identify those without unit test coverage; record the gap list in a working document (not committed as a permanent artifact)
- [ ] 27.4 Write Playwright end-to-end tests to fill the use case gaps identified in 27.1 (one test per uncovered use case)
- [ ] 27.5 Write Playwright end-to-end tests to fill the feature gaps identified in 27.2 (one test per uncovered feature, where not already satisfied by 27.4)
- [ ] 27.6 Add unit tests for uncovered business logic, repository methods, utility functions, and route handlers identified in 27.3 (prioritize critical paths)
- [ ] 27.7 Verify all tests are idempotent: each test must run multiple times in any order without shared state or external side effects; document and fix any tests that rely on ordering or leftover data
- [ ] 27.8 Verify every test covers a single discrete scenario; split any test asserting multiple unrelated behaviors
- [ ] 27.9 Run `utils/run-tests.ps1` and confirm all unit, integration, and UI tests pass together
- [ ] 27.10 Update `docs/spec.md` **Testing Instructions** section to reflect the current test suite layout and how to run each tier
- [ ] 27.11 Move `docs/spec.md` section 11 (**Comprehensive Test Coverage**) from **Not Yet Implemented** into a **Currently Implemented** phase narrative once tasks 27.1-27.9 are complete
