# Phase 25 Test Coverage Analysis

This document is the deliverable for `docs/todo.md` tasks **25.1** (use case
mapping) and **25.2** (feature mapping). It enumerates every documented use
case in `docs/usecases.md` and every feature listed under **Currently
Implemented Features** in `README.md`, and maps each one to the
Playwright spec file in `tests/e2e/` that exercises it end-to-end.

Tests added in Phase 25 to close gaps identified here are listed in the
last section.

## Use case coverage (task 25.1)

| Use case (docs/usecases.md) | Playwright spec |
|---|---|
| View release history from footer | `release-history.spec.js` |
| 1: Employee Books Desk for Two Days | covered indirectly by `mixed-single-multi.spec.js` (per-card single Book on a future date) |
| 2: Employee Books Desk and Parking Space for Half Day | `desk-parking-half-day.spec.js` (added in 25.9) |
| 3: Employee Attempts to Book Unavailable Desk | `no-desks-available.spec.js` (added in 25.9) |
| 4: Admin Sets Up Number of Desks and Parking Spaces | `admin-resource-config.spec.js` (added in 25.9) |
| 5: Admin Cancels User Desk Booking | `admin-cancel-booking.spec.js` (added in 25.9) |
| 6: User Cancels Their Own Desk Booking | covered indirectly by `undo-cancel.spec.js` (cancel happens immediately before the undo step) |
| 7: (Removed in Phase 23a) | n/a |
| 8: Admin Provisions User and User Completes Profile | `admin-provision-user.spec.js` (added in 25.9) |
| 9: First User Registers and Becomes Administrator | `first-user-admin.spec.js` (added in 25.3) |
| 10: Book Multiple Desks or Parking Spaces at Once | `multi-select-desk.spec.js`, `multi-select-parking.spec.js`, `mixed-single-multi.spec.js` |
| 11: Admin Reviews and Searches the Audit Log | `audit.spec.js` |
| 12: User Undoes a Recent Desk Booking Cancellation | `undo-cancel.spec.js` |
| 13: Admin Configures the Floor Plan Map | `maps.spec.js` |

## Feature coverage (task 25.2)

| Feature (README.md, "Currently Implemented Features") | Playwright spec |
|---|---|
| User Authentication and Management | covered indirectly by every spec that calls `POST /api/auth/login` (`audit.spec.js`, `multi-select-*.spec.js`, etc.) |
| First User Admin Registration | `first-user-admin.spec.js` (added in 25.3) |
| Application startup cleanup (called out in README under First User Admin Registration) | `startup-cleanup.spec.js` (added in 25.4) |
| Minimal Admin Provisioning and Profile Completion | `admin-provision-user.spec.js` (added in 25.9) |
| Desk Booking | `mixed-single-multi.spec.js` (per-card Book), `multi-select-desk.spec.js`, `undo-cancel.spec.js` (cancel) |
| Parking Space Reservation | `multi-select-parking.spec.js` |
| Floor Plan Maps | `maps.spec.js` |
| Multi-Select Desk and Parking Booking | `multi-select-desk.spec.js`, `multi-select-parking.spec.js`, `mixed-single-multi.spec.js` |
| Enhanced Admin Resource Configuration | `admin-resource-config.spec.js` (added in 25.9) |
| Admin Dashboard - configure resources | `admin-resource-config.spec.js` |
| Admin Dashboard - cancel any user's booking | `admin-cancel-booking.spec.js` (added in 25.9) |
| Admin Dashboard - user management (provision) | `admin-provision-user.spec.js` |
| Admin Dashboard - audit log | `audit.spec.js` |
| User Dashboard | covered indirectly by all bookings-related specs (the dashboard pulls counts from the same `/api/bookings/my-bookings` endpoint already exercised) |
| Booking Matrix Screen | `booking-matrix.spec.js` (added in 25.10) |
| Global Application Shell and Blue Theme | covered indirectly by every spec that navigates to a shell-rendering page; the shell, footer, sidebar, and account control are exercised by `release-history.spec.js`, `audit.spec.js`, `maps.spec.js`, etc. |
| Deployment Version and Release History | `version-deployment.spec.js`, `release-history.spec.js` |

## Gaps closed in Phase 25

These specs were added under tasks 25.3, 25.4, 25.9, and 25.10 to close the
gaps listed above:

- `tests/e2e/first-user-admin.spec.js` (25.3)
- `tests/e2e/startup-cleanup.spec.js` (25.4)
- `tests/e2e/desk-parking-half-day.spec.js` (25.9 / Use Case 2)
- `tests/e2e/no-desks-available.spec.js` (25.9 / Use Case 3)
- `tests/e2e/admin-resource-config.spec.js` (25.9 / Use Case 4)
- `tests/e2e/admin-cancel-booking.spec.js` (25.9 / Use Case 5)
- `tests/e2e/admin-provision-user.spec.js` (25.9 / Use Case 8)
- `tests/e2e/booking-matrix.spec.js` (25.10 / Booking Matrix feature)

## Notes on idempotency and ordering

The Playwright suite runs with `fullyParallel: false, workers: 1` (see
`playwright.config.js`), and every spec uses idempotent setup (`ensureAdmin`
falls back to login first, then registers if no users exist; user
provisioning re-uses an existing seed where possible) so reruns on a dirty
stack do not collide. Specs that exercise create / cancel flows scope each
booking to a far-future date with a per-run jitter so concurrent runs and
reruns produce non-overlapping bookings.

Two specs are sensitive to whether the database has any users at all:

- `first-user-admin.spec.js` runs the **first-user becomes admin** branch
  only when `GET /api/auth/check-users` returns `hasUsers: false` (a
  freshly-started stack). On a stack that already has users it asserts the
  closed-registration branch instead (form hidden, message visible, and
  `POST /api/auth/register` returns `403 REGISTRATION_CLOSED`). Both
  branches together cover Use Case 9.
- `startup-cleanup.spec.js` asserts the post-cleanup contract: the legacy
  `admin` / `Password123` account documented in
  `UserService.cleanupAdminPassword123User` is not a valid login. This is a
  weak proof of cleanup (a full restart-and-verify flow is out of scope for
  Playwright, which runs against a long-lived server) but it does pin down
  the documented behaviour as automated coverage.
