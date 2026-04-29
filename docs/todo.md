# TODO List

## Document Purpose

This file (`docs/todo.md`) lists **remaining code and test work** so the codebase **matches** `docs/spec.md`. It contains only tasks that represent genuine work still to be done; features already delivered are described in `README.md` in the project root.

---

## Phase 25: Comprehensive Playwright End-to-End Coverage

**Objective:** Deliver the end-to-end coverage commitment in `docs/spec.md` section 11: every documented use case in `docs/usecases.md` and every implemented feature has at least one Playwright end-to-end test, and the full test matrix runs clean.

**Dependencies:** None blocking; the Playwright specs themselves are in place. Final closure depends on resolving the pre-existing 185 backend Jest failures tracked in `docs/bugs/0015-BackendJestSuiteHas185PreExistingFailures.md`.

**Priority:** Medium

**Estimated Effort:** Tracked separately under bug 0015

### Tasks

- [ ] 25.11 Run `utils/run-tests.ps1` and confirm all unit, integration, and UI tests pass together. Currently blocked by the 185 pre-existing backend Jest failures documented in `docs/bugs/0015-BackendJestSuiteHas185PreExistingFailures.md`; the Phase 25 Playwright additions themselves are in place
- [ ] 25.12 Move `docs/spec.md` section 11 (**Comprehensive Test Coverage**) from **Not Yet Implemented** to **Currently Implemented** once 25.11 produces a clean run

---

## Phase 27: Key Fob Request and Allocation Subsystem

**Objective:** Implement the key fob request flag on desk bookings, configurable fob inventory (default and per-day), booking-time enforcement when inventory is set, and the fob calendar and historical-allocation reports for Office Administrators and Administrators, per `docs/spec.md` section 22.

**Dependencies:** Phase 2 (Desk Booking), Phase 5 (Admin Functionality), Phase 21 (Audit Trail) for fob-related audit events, Phase 26 (Office Administrator Role) so fob endpoints can enforce the new role.

**Priority:** High

**Estimated Effort:** 6-9 days

### Tasks

- [x] 27.1 Design database schema: add `bookings.fob_requested BOOLEAN NOT NULL DEFAULT FALSE`; add `fob_inventory` table with columns `(date DATE NULL UNIQUE, count INT NOT NULL, updated_by INT, updated_at)` (Phase 27a: `bookings.fob_requested TINYINT(1) NOT NULL DEFAULT 0` lands `AFTER status`. `fob_inventory` table has `id`, `date DATE NULL UNIQUE`, `count INT NOT NULL`, `updated_by INT NULL` referencing `users(id) ON DELETE SET NULL`, `updated_at`, `created_at`. Index `idx_fob_requested_active(fob_requested, status)` supports the per-day aggregation that Phase 27b's enforcement query will run.)
- [x] 27.2 Add migration creating the new column and table; ensure migration is idempotent (Phase 27a: `src/sql/10-fob-inventory-schema.sql` for fresh databases. `src/backend/database/migrations.js` probes `information_schema` before `ADD COLUMN` and `SELECT 1 FROM fob_inventory` before `CREATE TABLE`, so the step is safe on every boot.)
- [x] 27.3 Update Booking model and repository to read/write `fobRequested` (Phase 27a: `src/backend/models/Booking.js` constructor coerces the row's `fob_requested` to a strict boolean and exposes it as `fobRequested`. `toJSON` includes the field; `toDatabaseFormat` writes it back as 0/1. `BookingRepository.findByUserId`, `findById`, and `findAll` already `SELECT *`, so the flag flows through unchanged.)
- [x] 27.4 Implement `FobInventoryService` and `FobInventoryRepository` (Phase 27b: `src/backend/repositories/FobInventoryRepository.js` exposes `getDefault`, `getOverrideForDate`, `getAllOverrides`, `getAllOverridesInRange`, `upsertDefault`, `upsertOverride`, `deleteOverride`. Default-row uniqueness is enforced by the application — MySQL's UNIQUE on a NULLable column doesn't prevent multiple NULL rows, so the repo upserts against a `date IS NULL` predicate. `src/backend/services/FobInventoryService.js` adds the spec-required getDefault/getOverrideForDate/getEffectiveCountForDate/setDefault/setOverride/removeOverride methods plus `getAvailabilityForRange(startDate, endDate)` which returns `[{ date, configured, requested, available }]`. The range query runs once per call; per-day overlaps are computed in JS to avoid N round-trips. Strict YYYY-MM-DD validation, non-negative integer counts, and a "0 means 0, not unset" override-resolution rule are pinned by 17 unit tests in `tests/services/FobInventoryService.test.js`.)
- [x] 27.5 Inventory enforcement in `BookingService` (Phase 27b: `BookingService.createBooking` and `createBulkBookings` now run `_checkFobInventory(startDate, endDate)` when `options.fobRequested === true`. The check iterates each day in the inclusive range; any day where `effective_count !== null AND used + in_flight >= configured` is added to the offending list and the call rejects with `FobUnavailableError(offendingDates)` (exposes `code = 'FOB_UNAVAILABLE'`). Bulk handles partial success — desks that pass create the booking and bump a per-day `inFlightFobsPerDay` counter so later desks in the same call see them; desks that fail are reported in `results.failed` with `code: 'FOB_UNAVAILABLE'` and `offendingDates`. Days without inventory configured are tracked but not blocked, per spec section 22.)
- [x] 27.6 Admin API endpoints (Phase 27b: `src/backend/routes/admin-fob.js` mounted under `/api/admin/fob`. All six endpoints from the spec land — `GET /inventory`, `PUT /inventory/default`, `PUT /inventory/:date`, `DELETE /inventory/:date`, `GET /calendar?startDate&endDate`, `GET /history?startDate&endDate&format=csv`. Authorization: `authorize(['admin', 'office_admin'])` on every route per spec section 22 (fob configuration is an Office Administrator capability). CSV export sets `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename=fob-history-...csv`; cells with `,`, `"`, or newlines are quoted with doubled internal quotes.)
- [x] 27.7 Update `POST /api/bookings` and `POST /api/bookings/bulk` to accept `fobRequested` (Phase 27a: both routes accept `fobRequested` in the request body and forward it to `BookingService.createBooking` / `createBulkBookings` as `options.fobRequested`. The service writes the flag onto the new `Booking` row via `fob_requested`. Cancel and undo-cancel paths need no fob-specific code — cancellation flips the booking to `cancelled`, which is the same condition the fob aggregation excludes. No inventory enforcement yet; Phase 27b adds the `FOB_UNAVAILABLE` rejection branch.)
- [x] 27.8 Audit emission for fob lifecycle (Phase 27a + 27b: all five events live. Phase 27a delivered `FOB_REQUEST_GRANTED` from the booking routes. Phase 27b adds `FOB_REQUEST_DENIED` from both single-create and bulk-create when inventory rejects a fob; `FOB_INVENTORY_DEFAULT_UPDATED` from `PUT /inventory/default`; `FOB_INVENTORY_OVERRIDE_SET` from `PUT /inventory/:date`; `FOB_INVENTORY_OVERRIDE_REMOVED` from `DELETE /inventory/:date`. Catalogue entries are in `docs/audit-events.md`; payloads include `actor_role` via the audit-helper Phase 26 hook, so admin-vs-OA actions are distinguishable.)
- [x] 27.9 Desk booking page: **Fob needed** checkbox + inline availability hint + FOB_UNAVAILABLE error rendering (Phase 27c: `src/frontend/pages/desk-booking.html` adds the checkbox in the booking form. `src/frontend/js/desk-booking.js` reads the checkbox into `readFobRequestedFlag()`, threads `fobRequested` into `POST /api/bookings` and `POST /api/bookings/bulk`, calls the new `updateFobAvailabilityHint(start, end)` helper after every Check Availability, and translates a `FOB_UNAVAILABLE` server error into a date-aware "Fob unavailable on …" message that also refreshes the inline hint. The hint endpoint (`/api/admin/fob/calendar`) is admin-only; for regular users it returns 403 and the hint stays empty. `apiRequest` was extended to surface `error.code` and `error.offendingDates` from API error responses so handlers can react without scraping `error.message`.)
- [x] 27.10 My Bookings: small **Fob** badge on rows where `fobRequested = true` (Phase 27c: `src/frontend/js/bookings.js` renders a small orange "Fob" badge next to the desk number when `booking.fobRequested === true`. CSS lives in `src/frontend/css/styles.css` under `.status-badge.fob-badge`.)
- [x] 27.11/27.12/27.13/27.14 Fob admin pages + sidebar gating (Phase 27c: `src/frontend/js/admin-fob.js` is a new self-contained module with three pages — Fob Management (set default + manage per-date overrides), Fob Calendar (per-day configured vs requested vs available with red-tinted exhaustion rows), Fob History (rows + CSV export). All three tabs are added to `src/frontend/pages/admin.html` and the sidebar; `src/frontend/js/admin.js` reveals them when the signed-in user is `office_admin` OR `admin` and lazily loads the management page on first open. Calendar and History default to sensible date ranges (current month / last 30 days) on first open but only fetch when the admin clicks Load.)
- [x] 27.15 Unit tests for `FobInventoryService` and `BookingService` rejection paths (Phase 27b: `tests/services/FobInventoryService.test.js` covers 17 cases including default vs override resolution, the "0 means 0" rule, range aggregation with overrides + active fob bookings + the `available` floor at 0, range validation, and validation errors for non-integer / negative counts and bad dates. `tests/services/BookingService.test.js` adds three new tests: rejects with `FOB_UNAVAILABLE` when any day has no remaining inventory; allows the booking when no inventory is configured (effective count null); exposes `offendingDates` on the error so the route handler can include them in the API response.)
- [x] 27.16 Integration tests for fob enforcement and reports (Phase 27b: `tests/integration/fob-enforcement-phase27b.test.js` covers all seven scenarios from the task spec — fob succeeds with no inventory; fob succeeds within inventory; fob denied over inventory with `FOB_UNAVAILABLE` and `FOB_REQUEST_DENIED` emission; cancellation releases the fob so the next booker succeeds; calendar endpoint returns per-day configured/requested/available; history endpoint returns rows including user email + name; CSV export sets `text/csv` content type; regular User receives 403 on every fob admin endpoint; OA and Administrator both receive 200; `FOB_INVENTORY_DEFAULT_UPDATED` records previous_count → new_count with `actor_role: 'office_admin'`; PUT default rejects negative counts with `INVALID_COUNT`. 10 tests in this suite, all green in isolation.)
- [x] 27.17 Frontend Jest tests for the Fob UI (Phase 27c: `src/frontend/tests/admin-fob.test.js` covers the three admin pages — load + render of Fob Management with overrides, save default with negative-count validation, save override, remove override, calendar render with exhausted-day flag, calendar input validation (start > end), history render, CSV export Blob download path, CSV refusal on inverted range. `src/frontend/tests/desk-booking-fob.test.js` covers `readFobRequestedFlag` (reflects checkbox state, defaults to false when missing), `bookDesk` POST body shape with the flag, FOB_UNAVAILABLE error rendering with offending dates, and `updateFobAvailabilityHint` rendering exhausted days, the "tracked but not blocked" line, and silent clearing on 403. 19 new tests; the existing `desk-booking.test.js` was updated to expect `fobRequested: false` in the POST body shape. 254/254 frontend Jest pass.)
- [x] 27.18 Playwright end-to-end test (Phase 27c: `tests/e2e/fob-request.spec.js` runs the full loop — promotes an OA, OA sets a per-date override of 1 via the API, User A books a desk with Fob needed via the desk-booking page UI (success message includes "(with fob)"), API-level probe confirms User B is denied with `400 FOB_UNAVAILABLE` and `offendingDates: [date]`, User A cancels, User B retries and succeeds, the OA then opens the Fob Calendar via the admin UI and the row shows `0 of 1`, and the OA opens the Fob History which lists both A and B's allocations.)
- [x] 27.19 Move spec section 22 to Currently Implemented (Phase 27c: status line flipped to "Implemented (Phase 27)" with the 27a/27b/27c phase summary.)
- [x] 27.20 Fob endpoints added to spec API Endpoints section (Phase 27c: a new "Fob Inventory and Reports (Phase 27)" subsection lists all six `/api/admin/fob/*` endpoints with body / query shapes and audit emissions; `POST /api/bookings(/bulk)` entries now mention the optional `fobRequested` body field and the `400 FOB_UNAVAILABLE` rejection branch.)
- [x] 27.21 Use cases (Phase 27c: `docs/usecases.md` appends use cases 17 (User books a desk with fob within inventory), 18 (User denied when inventory exhausted), 19 (Office Administrator configures fob inventory), 20 (Office Administrator reviews calendar + history including CSV export). Each use case includes the manual testing path and a list of automated coverage files.)
- [x] 27.22 README (Phase 27c: User Authentication section unchanged; **Desk Booking** bullet list adds the optional fob flag + per-day hint + Fob badge entry; new **Key Fob Management (Office Administrator + Administrator)** sub-section under Currently Implemented Features describes the three admin pages and the audit emissions; **User Guide → Booking a Desk** flow now includes the Fob needed step and the rejection message; Implementation Summary gains a Phase 27 line covering 27a/27b/27c.)

---

## Phase 28: Select-as-Toggle and Uniform Booking Card Button Sizing

**Objective:** Make the per-card **Select** button on the desk booking and parking reservation pages a true toggle (click to select, click again to deselect) and render it at the **same dimensions** as the per-card **Book** / **Reserve** buttons via a shared CSS class. Per `docs/spec.md` section 23, refining section 19. This corrects a current regression where Select is noticeably larger than Book on the desk booking page.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 15 (Multi-Select). The hide-on-select rule from earlier work continues to apply.

**Priority:** Medium

**Estimated Effort:** 0.5-1 day

### Tasks

- [x] 28.1 Audit current CSS in `src/frontend/css/styles.css` for `.btn-primary`, `.btn-secondary`, `.select-desk-btn`, `.select-parking-btn`, `.book-desk-btn`, `.reserve-parking-btn` (or equivalents) and identify why Select renders larger than Book on desk cards (root cause: legacy `.desk-card .book-desk-btn { width: 100%; margin-top: 1rem; }` rule, same specificity as the Phase 23.12 `.desk-card-buttons .book-desk-btn` flex rule, gave Book a top margin Select did not have, leaving Book visibly shorter inside the flex row)
- [x] 28.2 Define a single shared CSS class (e.g. `.btn-card-action`) with a fixed `min-width`, `min-height`, padding, and font-size; apply this class to the Select, Book, and Reserve buttons on both desk and parking cards (`src/frontend/css/styles.css` adds `.btn-card-action` with `min-width: 7rem`, `min-height: 2.5rem`, `padding: 0.75rem 1rem`, `font-size: 1rem`, `box-sizing: border-box`; the legacy `.desk-card .book-desk-btn` rule is removed)
- [x] 28.3 Update `src/frontend/js/desk-booking.js` to render the Select button with the shared class and an `aria-pressed` attribute reflecting the current selection state for that desk (`displayDesks` template emits `class="btn-secondary btn-card-action select-desk-btn[ is-selected]" aria-pressed="true|false"`)
- [x] 28.4 Update `src/frontend/js/parking.js` to render the Select button with the shared class and an `aria-pressed` attribute reflecting the current selection state for that parking space (`displayParkingSpaces` template mirrors the desk-card pattern)
- [x] 28.5 Update Select click handlers in `src/frontend/js/desk-booking.js` and `src/frontend/js/parking.js` to **toggle**: if the resource is already in the selection, remove it; otherwise add it. The existing **Clear Selection** behaviour for "deselect all" remains unchanged (the existing `toggleDeskSelection` / `toggleParkingSpaceSelection` functions already toggled the Set; this commit aligns the button label, `aria-pressed`, and `.is-selected` class on each click and on `clearSelection` / `clearParkingSelection`)
- [x] 28.6 Update the Select button's visible label and styling on toggle: when selected, show **Selected** (or equivalent affordance such as a checkmark) and apply a distinct active style; when deselected, return to the default **Select** label and style. Re-render does not flicker (use a class flip rather than rebuilding the element where reasonable) (label flips between **Select** and **Selected**; `.is-selected` class is added/removed on the same element rather than re-rendering the card)
- [x] 28.7 Confirm hide-on-select still applies: when a card is in the selected state, the immediate **Book** / **Reserve** control on that same card stays hidden; toggling Select off must restore that control (Phase 23.12 `bookBtn.hidden` / `reserveBtn.hidden` toggle is preserved alongside the new label/aria/class flips; tests `hides the per-card Book button when the desk is selected (23.12)` and `shows the per-card Book button again when the desk is deselected (23.12)` continue to pass)
- [x] 28.8 Add frontend Jest tests in `src/frontend/tests/desk-booking.test.js` covering: equal computed width and height of Select / Book on a rendered card; Select click toggles selection on then off; `aria-pressed` flips between `true` and `false`; Book button hidden when Selected, restored when toggled off (4 new tests: `Select toggles selection on then off; aria-pressed flips with it`, `Select and Book share the .btn-card-action sizing class`, `Select renders pre-pressed when the desk is in the selection at render time`, `clearSelection resets every Select toggle to its unpressed state`. Computed-pixel parity is left to the Playwright spec — jsdom does not produce reliable layout boxes — and is asserted there.)
- [x] 28.9 Add frontend Jest tests in `src/frontend/tests/parking-multiselect.test.js` covering the same behaviour for parking cards (Select toggle, sizing, Reserve hide-on-select) (4 new mirror tests for the parking page)
- [x] 28.10 Add Playwright end-to-end test (`tests/e2e/select-toggle.spec.js`): on the desk booking page, render at least 3 desks; assert the Select and Book buttons report the same bounding-box size; click Select on one desk and assert it shows Selected and the Book button on that card is hidden; click Select again and assert the desk is no longer in the selection and Book is restored; repeat the same flow on the parking reservation page (one spec with two scenarios — desk and parking — sharing the seed admin/user/inventory plumbing used by `tests/e2e/multi-select-desk.spec.js`. Run with `npm run test:e2e` from the repo root against the live dev stack.)
- [x] 28.11 Move `docs/spec.md` section 23 (**Select-as-Toggle and Uniform Booking Card Button Sizing**) from **Not Yet Implemented** to **Currently Implemented** once tasks 28.1-28.10 pass (section 23 now opens with `**Status:** Implemented (Phase 28)` plus pointers to the css, js, jest, and playwright artefacts)
- [x] 28.12 Update root `README.md` to describe the Select toggle behaviour and uniform button sizing on desk and parking cards (Multi-Select section now describes the toggle, the `aria-pressed` exposure, the shared sizing class, and the hide-on-select interaction)
- [x] 28.13 Update `docs/usecases.md` if any documented manual path describes the previous Select / Clear Selection flow so it reflects the new toggle behaviour (Use Case 10 Steps and Manual Testing Path updated: Select is described as a toggle, the per-card Book hide-on-select behaviour is called out, and the manual path now includes a deselect-by-clicking-Selected-again step)

---

## Phase 29: Loading Animation on Admin Save Configuration

**Objective:** Add an inline loading animation to the admin **Resource Configuration** view's **Save Configuration** action for desks (and, symmetrically, parking spaces) so the admin gets immediate visual feedback during the in-flight request and cannot accidentally double-submit. Per `docs/spec.md` section 24.

**Dependencies:** Phase 5 (Admin Functionality), Phase 7 (Enhanced Admin Resource Configuration), Phase 20 (Global Application Shell and Blue Theme) for the consistent colour palette.

**Priority:** Low

**Estimated Effort:** 0.5 day

### Tasks

- [x] 29.1 Add a CSS-only spinner (or short progress bar) class in `src/frontend/css/styles.css` that uses the existing blue primary palette and respects `prefers-reduced-motion: reduce` (animation removed or static when the user prefers reduced motion)
- [x] 29.2 Update `src/frontend/js/admin.js` Save Configuration handler for **desks** so that when the request fires it: disables the button, sets `aria-busy="true"`, renders the spinner inside or beside the button, and prevents further clicks until the response settles
- [x] 29.3 Apply the same change to the Save Configuration handler for **parking spaces** so both flows share behaviour (the single Save Configuration button fires both desk and parking requests in parallel; the spinner wraps the combined Promise)
- [x] 29.4 On success, transition to a brief success state (e.g. checkmark for a short interval) before returning to idle; the existing success notification surface continues to display the textual confirmation
- [x] 29.5 On error, stop the animation, return the button to idle state, clear `aria-busy`, and rely on the existing error notification surface for the failure message
- [x] 29.6 Confirm no new audit events are needed (the existing `ADMIN_CONFIG_UPDATED` events from Phase 21 continue to record the underlying mutation)
- [x] 29.7 Add frontend Jest tests in `src/frontend/tests/admin.test.js`: clicking Save Configuration disables the button and sets `aria-busy="true"`; on a mocked successful response, the button re-enables and `aria-busy` returns to `false`; on a mocked error response, the button re-enables, `aria-busy` returns to `false`, and the error notification is shown; double-clicking the button while in flight does not produce a second network request
- [x] 29.8 Add Playwright end-to-end test (`tests/e2e/admin-save-config.spec.js`): admin opens **Resource Configuration**, changes the desk count, clicks **Save Configuration**, and observes the spinner appear and the button become disabled for the duration of the request, then return to idle on success; repeat for parking count (gated on `E2E_RUN_AUTHENTICATED` until a deterministic admin seed is wired into Playwright fixtures)
- [x] 29.9 Move `docs/spec.md` section 24 (**Loading Animation on Admin Save Configuration**) from **Not Yet Implemented** to **Currently Implemented** once tasks 29.1-29.8 pass
- [x] 29.10 Update root `README.md` Admin Features section to mention that Save Configuration shows a loading indicator while saving

---

## Phase 30: Vertical Alignment of Form Controls and Action Buttons

**Objective:** Apply a single shared row layout so every input + adjacent action button (e.g. **Check Availability**, **Search**, **Load Matrix**, **Save Configuration**) renders on the **same Y axis**. Today the parking reservation row drifts vertically between the date input and **Check Availability**; the same risk exists on other booking and filter rows. Per `docs/spec.md` section 25.

**Dependencies:** Phase 20 (Global Application Shell and Blue Theme) for the consistent layout primitives.

**Priority:** Medium

**Estimated Effort:** 1 day

### Tasks

- [x] 30.1 Audit existing rows for Y-axis drift (root cause identified: `.form-group { margin-bottom: 1.5rem }` inside a flex row with `align-items: flex-end` pushes labelled inputs 1.5rem above unlabelled buttons; affected rows are the parking booking-form, desk-booking booking-form, bookings search-filter-group, matrix filters-panel, and admin Audit search-filter-group; admin Resource Configuration uses a stacked layout with no row, so no drift to fix there; admin Maps upload form already uses `.form-row` from Phase 23e)
- [x] 30.2 Define a shared `.form-row` class in `src/frontend/css/styles.css` (`display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap`; child rule `.form-row .form-group { margin-bottom: 0 }` to remove the drift; direct-child rule on `button`/`input`/`select` pinning `min-height: 2.75rem` so bare controls match labelled-input wrappers)
- [x] 30.3 Apply `.form-row` to the date / time period / **Check Availability** row on Parking Reservation (`src/frontend/pages/parking.html`)
- [x] 30.4 Apply `.form-row` to the start date / end date / **Check Availability** row on Desk Booking (`src/frontend/pages/desk-booking.html`)
- [x] 30.5 Apply `.form-row` to the search / status filter / type filter row on My Bookings (`src/frontend/pages/bookings.html`)
- [x] 30.6 Apply `.form-row` to the date range / user / desk / parking / **Load Matrix** filter row on Booking Matrix (`src/frontend/pages/matrix.html`; the previously block-styled action buttons are now flex children of the same row so they share the row baseline)
- [x] 30.7 Apply `.form-row` to admin audit search row (`src/frontend/pages/admin.html`); Resource Configuration uses a stacked layout (no side-by-side row to fix); Maps upload row already uses `.form-row` (pre-existing); Maps editor toolbar keeps its `align-items: center` inline-label layout (different alignment contract); fob inventory UI not yet built (Phase 27)
- [x] 30.8 Add frontend Jest tests asserting the shared `.form-row` structural contract (`src/frontend/tests/form-row-alignment.test.js`; 14 tests: CSS contract on the rule, the child margin-bottom-zero rule, and the direct-child min-height rule, plus per-page assertions that each affected container has the `.form-row` class and its expected interactive children. jsdom does not produce real layout boxes; the pixel-alignment assertion is in the Playwright spec — see 30.9.)
- [x] 30.9 Add Playwright end-to-end test (`tests/e2e/form-row-alignment.spec.js`) covering the parking, desk booking, and booking matrix pages — queries the row's interactive controls and asserts their `boundingBox` bottoms align within a 1px tolerance
- [x] 30.10 Move `docs/spec.md` section 25 (**Vertical Alignment of Form Controls and Action Buttons**) from **Not Yet Implemented** to **Currently Implemented** (section 25 now opens with `**Status:** Implemented (Phase 30)` and pointers to the css, html, jest, and playwright artefacts)
- [x] 30.11 Update root `README.md` to note the consistent form-row alignment across booking, filter, and admin rows (Implementation Summary now includes a Phase 30 line)

---

## Phase 31: Booking Matrix Initial State Polish

**Objective:** Tidy the **Booking Matrix** screen so it looks deliberate at every stage of its lifecycle: a clear filter card up top, an explicit **empty state** before any load, a **loading state** while a request is in flight, a **loaded state** with the matrix, and a recoverable **error state** on failure. Per `docs/spec.md` section 26.

**Dependencies:** Phase 9 (Booking Matrix Screen), Phase 20 (Global Application Shell), Phase 24 (loading-spinner CSS from the Save Configuration animation), Phase 30 (`.form-row` for the filter card).

**Priority:** Medium

**Estimated Effort:** 1-2 days

### Tasks

- [x] 31.1 Refactor `src/frontend/pages/matrix.html`: wrap the filter inputs and **Load Matrix** button in a single bordered filter card (`.matrix-filter-card`), and add an explicit content region (`#matrix-region`) below it that hosts the empty / loading / loaded / error states (the legacy `#matrix-message` is kept above the region for transient validation / export-success toasts that are independent of the lifecycle state)
- [x] 31.2 Add CSS for `.matrix-filter-card` (`src/frontend/css/styles.css` — bordered card with the blue accent from the section 14 palette, consistent padding, narrow-viewport breakpoint trims padding to 1rem)
- [x] 31.3 Add CSS and markup for `.matrix-empty-state` (centered SVG calendar icon, title **"Select a date range to view bookings"**, short description pointing the user to the filter card's **Load Matrix** button; no action button)
- [x] 31.4 Add CSS for `.matrix-loading-state` (centered `.matrix-spinner` reusing the Phase 29 `btn-spinner-rotate` keyframe with a larger 2.5rem variant; `@media (prefers-reduced-motion: reduce)` rule disables the rotation)
- [x] 31.5 Add CSS and markup for `.matrix-error-state` (centered alert icon with red accent, error message slot, **Retry** button — `#matrix-retry-btn` wired by `setMatrixState('error')` to re-fire the same `loadMatrix()` call with the current filters)
- [x] 31.6 Update `src/frontend/js/matrix.js` to swap `#matrix-region` between the four states (`setMatrixState('empty' | 'loading' | 'loaded' | 'error', { message })`; `loadMatrix()` flips to loading before the network call and to loaded/error after; the loaded state injects an empty `#matrix-container` slot for `renderMatrix()` to populate, preserving backward compatibility with the existing grid renderer; subsequent reloads go loading → loaded/error and never drop back to empty)
- [x] 31.7 Confirm the filter card uses `.form-row` from Phase 30 so the Y-axis alignment rule applies (`.matrix-filter-card > .filters-panel.form-row` — the filter-card frames the same `.form-row` shipped in Phase 30; vertical alignment of date inputs, selects, and action buttons is preserved)
- [x] 31.8 Verify responsive behaviour at narrow viewports (a `@media (max-width: 600px)` rule trims the filter card and state placeholder padding so they stop short of the viewport edge; the `.form-row` already wraps so the date inputs and multi-selects flow onto multiple lines without horizontal scroll)
- [x] 31.9 Add frontend Jest tests in `src/frontend/tests/matrix.test.js` (10 new tests under **Phase 31: Booking Matrix state transitions** — `setMatrixState` for each of the four states (including XSS-safe error rendering), `loadMatrix` validation rejection, the empty → loading → loaded transition, the loading → error transition, the Retry button re-firing the request, and the loading → loaded path on a second load that proves it never drops back to empty)
- [x] 31.10 Add Playwright end-to-end test (`tests/e2e/matrix-states.spec.js` — three scenarios: initial filter-card + empty state on first open; Load Matrix transitioning empty → loading → loaded with a deliberately-slowed route handler so the spinner is observable; a forced 500 from `page.route` followed by a working Retry that re-fires the same request and lands on loaded)
- [x] 31.11 Move `docs/spec.md` section 26 from **Not Yet Implemented** to **Currently Implemented** (section 26 now opens with `**Status:** Implemented (Phase 31)` and pointers to the css, html, jest, and playwright artefacts)
- [x] 31.12 Update root `README.md` Booking Matrix Screen section (added a Phase 31 bullet describing the bordered filter card, the four lifecycle states, and the Retry behaviour)
- [x] 31.13 Update `docs/usecases.md` if any documented manual path describes the previous matrix initial state so the steps reflect the new empty / loading flow (no existing use case references the matrix; nothing to update)

---

## Phase 32: SVG Floor Plan Upload Support

**Objective:** Extend the existing floor plan upload (per spec section 17) to accept **SVG** files in addition to PNG and JPG, with server-side sanitisation that strips active content and an `<img>`-based renderer that preserves the same browser sandbox guarantees. Per `docs/spec.md` section 27.

**Dependencies:** Phase 23 (Floor Plan Maps backend + UI delivered).

**Priority:** Medium

**Estimated Effort:** 2-3 days

### Tasks

- [x] 32.1 Update the admin **Maps** upload control in `src/frontend/js/admin-maps.js` and `src/frontend/pages/admin.html`: file picker `accept="image/png,image/jpeg,image/svg+xml"`, accepted-types hint mentions SVG
- [x] 32.2 Update the server-side mime allow-list (`src/backend/services/MapService.js` `ACCEPTED_MIME_TYPES`) to accept `image/svg+xml`; the route's `express.raw` `type` derives from the same map so the SVG MIME is automatically allowed. Magic-byte sniff in `MapService.hasImageMagicBytes` delegates to `looksLikeSvg` which checks the first non-whitespace token after an optional UTF-8 BOM is `<?xml`, `<!--`, `<!DOCTYPE`, or `<svg` (case-insensitive)
- [x] 32.3 SVG sanitiser at `src/backend/utils/svg-sanitizer.js` exporting `sanitizeSvg`, `isSafeHrefValue`, `looksLikeSvg`. Strips `<script>`, `on*`, `<foreignObject>`; rejects DOCTYPE-with-ENTITY; sanitises `href`/`xlink:href` to same-origin relative / fragment / safe `data:image/{png,jpeg,gif};base64` only; throws `Error('Invalid SVG: ...')` on unparseable input
- [x] 32.4 Wired into `MapService.replaceFloorPlan`: `image/svg+xml` uploads pass through `sanitizeSvg` before `fs.writeFile`; only sanitised bytes hit disk; version-bump rule unchanged
- [x] 32.5 Size cap reapplied to the post-sanitise byte length; oversize SVG returns 413 IMAGE_TOO_LARGE via the existing `express.raw` limit and a defensive re-check
- [x] 32.6 Map renderer already embeds the floor plan via `<img class="map-floor-plan" src=...>` — no SVG-specific code path; `object-fit: contain` and `aspect-ratio: 1/1` come from `.map-floor-plan` / `.map-viewport` in `styles.css`
- [x] 32.7 Markers continue to overlay because they live in `.map-overlay` (absolute, normalised coordinates) on top of the `<img>`; pinned by new tests in `src/frontend/tests/map-renderer.test.js`
- [x] 32.8 The existing `MAP_FLOOR_PLAN_UPLOADED` payload already includes `image_mime`, so admins reviewing the trail see `image/svg+xml` vs `image/png|jpeg` without a new event type
- [x] 32.9 `tests/utils/svg-sanitizer.test.js` — 32 tests covering script removal, self-closing scripts, on* attributes (single/double/unquoted), `<foreignObject>` removal, ENTITY rejection (including billion-laughs), safe href preservation, dangerous href scheme rejection, data: URI policy, BOM tolerance, idempotency, parser rejection paths
- [x] 32.10 `tests/integration/maps.test.js` — Phase 32 SVG suite: safe SVG accepted with 200 + audit row; SVG with `<script>` stored without script; SVG with `onload` stored without `onload`; SVG with `<!ENTITY>` rejected with 400 INVALID_IMAGE; PNG bytes under `Content-Type: image/svg+xml` rejected; SVG bytes under `Content-Type: image/png` rejected; oversize SVG rejected with 413 IMAGE_TOO_LARGE
- [x] 32.11 `src/frontend/tests/map-renderer.test.js` — Phase 32 SVG describe block: `<img>` (not inlined SVG) is rendered; src points at `/api/maps/desk/floor-plan/image?v=...`; viewport classes survive; landmark and resource marker overlays render at their normalised coordinates; SVG and PNG produce identical DOM
- [x] 32.12 `tests/e2e/maps-svg.spec.js` — admin uploads a hostile SVG (script + onload), user opens the desk booking page, the page sentinel `window.__pwn_svg_e2e` stays `false` (browser sandbox + sanitiser both prevent execution), the floor plan endpoint serves bytes with no `<script>` or `onload`, landmark and desk marker remain visible
- [x] 32.13 Move `docs/spec.md` section 27 (**SVG Floor Plan Upload Support**) status header to "Delivered in Phase 32"
- [x] 32.14 Update root `README.md` Floor Plan Maps section: SVG joins PNG and JPEG; one-line note on server-side sanitisation and `<img src>` sandbox
- [x] 32.15 Update `docs/usecases.md` Use Case 13: SVG mentioned in the upload step and in the Automated coverage line
