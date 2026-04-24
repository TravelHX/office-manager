# TODO List

## Document Purpose

This file (`docs/todo.md`) lists **remaining code and test work** so the codebase **matches** `docs/spec.md`. It contains only tasks that represent genuine work still to be done; features already delivered are described in `README.md` in the project root.

---

## Phase 21: Administrative Audit Trail

**Objective:** Provide an **admin-only Audit** section and **append-only audit log** of meaningful actions by **all users** (including admins), with a **simple search** for administrators, per `docs/spec.md` section 15.

**Dependencies:** Phase 5 (Admin Functionality), Phase 8 (User Authentication and Management), Phase 20 (application shell) for consistent admin navigation.

**Priority:** High

**Estimated Effort:** 6-10 days

**Sequencing note:** Complete Phase 23 overtime removal before this phase so audit events are not wired for code that will be deleted.

### Tasks

- [x] 21.1 Finalize event type catalog and field list from `docs/spec.md` section 15; list each HTTP route or service method that must emit an event (see `docs/audit-events.md`)
- [x] 21.2 Design database schema for audit events (table name, columns, indexes for time, actor_user_id, action_type, full-text or composite strategy for search)
- [x] 21.3 Add migration creating audit table; document retention approach (default unlimited or documented cap) (`src/sql/08-audit-events-schema.sql`; retention deferred, documented in `docs/audit-events.md`)
- [x] 21.4 Implement AuditEvent model and repository (append-only insert; admin-only list/search with parameterized queries) (`src/backend/models/AuditEvent.js`, `src/backend/repositories/AuditEventRepository.js` — `update`/`delete` throw append-only errors)
- [x] 21.5 Implement AuditService (or equivalent) to record events with consistent shape; add helper used by routes/services (`src/backend/services/AuditService.js` — no emission sites wired yet; that is Phase 21d, to follow Phase 23 overtime removal)
- [ ] 21.6 Wire audit emission for **authentication**: login success, logout (and failed login if included)
- [ ] 21.7 Wire audit emission for **desk bookings**: create, user cancel, admin cancel
- [ ] 21.8 Wire audit emission for **parking**: create reservation, user cancel, admin cancel
- [ ] 21.9 Wire audit emission for **admin configuration** and **desk/parking admin** operations (counts, numbering, matrix-triggered changes if any)
- [ ] 21.10 Wire audit emission for **user management** (create, delete, password change, profile completion) for both self-service and admin paths
- [ ] 21.11 Wire audit emission for **bulk booking** and any other mutating flows not yet covered
- [ ] 21.12 Implement `GET /api/admin/audit-events` (admin only): pagination, `search` query matching documented fields; return safe JSON (no secrets)
- [ ] 21.13 Add **Audit** item to admin UI (sidebar); build page or tab with table and **search box**; restrict visibility to admins
- [x] 21.14 Add unit tests for AuditService and repository (append-only, search behavior) (`tests/models/AuditEvent.test.js`, `tests/repositories/AuditEventRepository.test.js`, `tests/services/AuditService.test.js` — 31 tests passing)
- [ ] 21.15 Add integration tests for audit API (403 for non-admin, 200 with events for admin, search returns expected rows)
- [ ] 21.16 Add integration or frontend tests proving representative actions create audit rows
- [ ] 21.17 Add Playwright end-to-end test: admin opens Audit, searches, sees expected event after a seeded action
- [ ] 21.18 Update `docs/spec.md` API section with implemented audit endpoints; move section 15 to **Currently Implemented** when done
- [ ] 21.19 Update root `README.md` User Guide (admin: Audit section) after implementation
- [ ] 21.20 Update `docs/usecases.md` with admin audit review and search flow

---

## Phase 22: Release History Playwright Coverage

**Objective:** Close the Playwright end-to-end gap for the already-implemented release history feature (spec section 12).

**Dependencies:** Phase 18 (version APIs and footer display)

**Priority:** Medium

**Estimated Effort:** 0.5 day

### Tasks

- [ ] 22.1 Add Playwright end-to-end test: footer version link opens release history and content loads

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
- [ ] 23.5 Update auth / profile-complete restrictions to drop overtime references; grep codebase for `overtime` and clean remaining references
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
- [ ] 23.18 Update `docs/spec.md` **Currently Implemented** and API lists after delivery

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
- [ ] 24.4 Update desk repository/service queries to return desks ordered by numeric value of the desk number (e.g. SQL `ORDER BY CAST(number AS UNSIGNED), number` or equivalent natural sort) with stable secondary ordering
- [ ] 24.5 Update parking space repository/service queries to return spaces ordered numerically with stable secondary ordering
- [ ] 24.6 Update desk selection list on the desk booking page to display desks in numeric order
- [ ] 24.7 Update parking space selection list on the parking reservation page to display spaces in numeric order
- [ ] 24.8 Update admin Desk Configuration view so listed desk numbers appear in numeric order
- [ ] 24.9 Update admin Parking Configuration view so listed parking space numbers appear in numeric order
- [ ] 24.10 Update admin All Bookings and All Parking Reservations views (where grouped or sorted by resource number) to use numeric order
- [ ] 24.11 Update Booking Matrix resource axis labels (desks and parking) to appear in numeric order
- [ ] 24.12 Update My Bookings listings (desk bookings and parking reservations) so resources appear in numeric order
- [ ] 24.13 Update any dropdowns, selectors, or filter controls that list desks or parking spaces to use the same numeric order
- [ ] 24.14 Ensure server-side and client-side sorts produce identical ordering (no mixed strategies across views)
- [ ] 24.15 Write unit tests for the natural sort utility covering: purely numeric identifiers, mixed alphanumeric identifiers, tie-breaking stability
- [ ] 24.16 Write integration test asserting `GET /api/desks` returns desks in numeric order when desks include numbers that would sort incorrectly as strings (e.g. 1, 2, 10, 11)
- [ ] 24.17 Write integration test asserting `GET /api/parking-spaces` returns parking spaces in numeric order with the same data shape
- [ ] 24.18 Write JavaScript tests for the frontend natural sort utility
- [ ] 24.19 Write JavaScript tests asserting the desk booking page, parking reservation page, admin configuration views, and booking matrix render resources in numeric order given mixed-magnitude fixtures
- [ ] 24.20 Write Playwright end-to-end test: with at least 11 desks and 11 parking spaces configured, verify the booking pages, admin views, and booking matrix all display resource numbers in natural numeric order
- [ ] 24.21 Update root `README.md` once implemented to reflect that resource lists are presented in natural numeric order

---

## Phase 25: Comprehensive Playwright End-to-End Coverage

**Objective:** Deliver the end-to-end coverage commitment in `docs/spec.md` section 11: every documented use case in `docs/usecases.md` and every implemented feature has at least one Playwright end-to-end test. Fill gaps left by feature phases where Playwright was deferred (first-user admin registration, startup cleanup, multi-select desk and parking booking, version tracking in deployment).

**Dependencies:** Phase 23 (so tests are not written against overtime code slated for removal).

**Priority:** Medium

**Estimated Effort:** 4-6 days

### Tasks

- [ ] 25.1 Enumerate every use case in `docs/usecases.md` and map each to existing Playwright end-to-end tests; list use cases with no Playwright coverage
- [ ] 25.2 Enumerate every feature listed under **Currently Implemented Features** in `README.md` and map each to existing Playwright tests; list features with no Playwright coverage
- [ ] 25.3 Write Playwright end-to-end test for first user registration becoming admin (covers deferred task from Phase 14)
- [ ] 25.4 Write Playwright end-to-end test for application startup cleanup (covers deferred task from Phase 14)
- [ ] 25.5 Write Playwright end-to-end test for multi-select desk booking flow (covers deferred task from Phase 15)
- [ ] 25.6 Write Playwright end-to-end test for multi-select parking booking flow (covers deferred task from Phase 15)
- [ ] 25.7 Write Playwright end-to-end test for mixed single and multi-select booking flow (covers deferred task from Phase 15)
- [ ] 25.8 Write Playwright end-to-end test for version tracking on deployment (covers deferred task from Phase 18)
- [ ] 25.9 Write Playwright end-to-end tests to fill any remaining use case gaps identified in 25.1
- [ ] 25.10 Write Playwright end-to-end tests to fill any remaining feature gaps identified in 25.2
- [ ] 25.11 Run `utils/run-tests.ps1` and confirm all unit, integration, and UI tests pass together
- [ ] 25.12 Move `docs/spec.md` section 11 (**Comprehensive Test Coverage**) from **Not Yet Implemented** to **Currently Implemented** once the Playwright suite covers every use case and feature
