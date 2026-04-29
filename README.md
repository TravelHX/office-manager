# Office Manager

## Document Purpose

This file (`README.md`) lives **only in the project root**. It documents **functionality that has been implemented** (what works today), how to use it, and where it is deployed. It does not describe the full intended product; for that see `docs/spec.md`. For work remaining to reach the specification, see `docs/todo.md`.

## Deployed Application

**Live Application:** https://hx-hub-d-office-manager-app.azurewebsites.net/

## Project Overview

Office Manager is a web application designed to manage office operations and resources. The application provides tools for tracking and managing desk bookings and parking reservations.

## Currently Implemented Features

### User Authentication and Management

- Email-based login (email address is the username/login identifier)
- **Role-based access control with three roles**: `user`, `office_admin` (Office Administrator), and `admin` (Administrator). The role is the canonical source of truth; the legacy `isAdmin` flag is derived from `role === 'admin'`.
- Session/token management for logged-in users
- User indicator in top-left showing logged-in user information
- Access control: logged-in users can access all features; non-logged-in users can only view available desks/spaces
- Login redirect when unauthenticated users attempt to book
- Password change functionality
- Password reset with time-limited tokens (no outbound email; admin shares reset links)

#### Three-role model and capabilities matrix

| Capability                                              | User | Office Administrator | Administrator |
|---------------------------------------------------------|:----:|:--------------------:|:-------------:|
| Book a desk / reserve a parking space                   |  Y   |          Y           |       Y       |
| Cancel **own** booking / reservation (and undo)         |  Y   |          Y           |       Y       |
| View **all** bookings and parking reservations          |      |          Y           |       Y       |
| Cancel **another user's** booking / reservation         |      |          Y           |       Y       |
| Resource Configuration (desk / parking counts, renames) |      |                      |       Y       |
| User Management (provision, delete, change role)        |      |                      |       Y       |
| Maps (upload floor plans, place markers)                |      |                      |       Y       |
| Audit log                                               |      |                      |       Y       |

Audit rows record the actor's role in the payload (`actor_role`) so administrative actions taken by an Office Administrator are distinguishable from those taken by an Administrator.

#### Granting or revoking the Office Administrator role

1. Sign in as an Administrator and open **Admin → User Management**
2. Find the target user's row. The **Role** column contains a `<select>` with **User**, **Office Administrator**, **Administrator** plus a **Save** button
3. Choose the new role and click **Save**. The browser PUTs `/api/auth/users/:id/role`. The server validates the role token, enforces the **last-admin invariant** (you cannot demote the only remaining Administrator — the request is rejected with `400 CANNOT_DEMOTE_LAST_ADMIN`), and emits a `USER_ROLE_CHANGED` audit event
4. The change takes effect on the user's **next login** (the JWT is re-issued with the new role)
5. To revoke the Office Administrator role, repeat with `User` (or `Administrator`) selected

### First User Admin Registration

- First user to register automatically becomes admin
- Registration screen displayed when no users exist in the system
- Application startup cleanup: removes legacy test users and provides clean slate for production
- Subsequent users do not automatically become admin
- Self-service registration is closed once any user exists: the registration API returns 403 (`REGISTRATION_CLOSED`) and the registration page hides the form and shows a message directing the visitor to log in or contact an administrator

### Minimal Admin Provisioning and Profile Completion

- Admins provision new users with **email and full name only**
- Admin shares a time-limited **profile setup link** with the new user
- User completes **password** and **office location** on first access via the setup link
- Incomplete-profile users cannot access protected features (bookings, reservations) until completion
- User list shows **Pending setup** vs **Active** profile status

### Desk Booking

- View available desks for selected date ranges
- Book desks for single or multiple days
- View and manage personal desk bookings
- Cancel own bookings
- **Undo a self-cancelled desk booking within 30 seconds** — a toast with an Undo button appears on My Bookings immediately after cancelling. Undo restores the booking only if the window has not expired and the desk has not been taken by another booking in the meantime.
- Admin can view all bookings and cancel any booking (admin-initiated cancels are not eligible for user Undo)
- Remaining desk count displayed for selected dates (availability enhancement)
- Booking proceeds directly without confirmation modal (streamlined flow)
- Booking validation: one desk per person per period, one person per desk per day
- Clear error messages for booking conflicts and overlapping date ranges
- **Optional Key Fob request (Phase 27)** — tick **Fob needed** in the booking form to request a building key fob alongside the desk. When an inventory limit has been configured by an Office Administrator, an inline per-day availability hint shows how many fobs remain for the selected dates; the booking is rejected with a date-aware **"Fob unavailable"** message if any day in the range is exhausted. Bookings on **My Bookings** that included a fob request show a small **Fob** badge.

### Key Fob Management (Office Administrator + Administrator)

- **Fob Management** admin page sets the daily default fob count and per-date overrides. Both are optional — if no inventory is configured, fob requests on bookings are tracked but never blocked.
- **Fob Calendar** shows configured / requested / available counts for every day in a chosen range; days where the inventory has been exhausted are tinted red.
- **Fob History** lists every fob-requested booking that overlaps the chosen range (active and cancelled), including the person who took the fob (name + email), the desk number, and the dates. **Export CSV** downloads the same rows in a `text/csv` file.
- All four fob audit events (`FOB_REQUEST_GRANTED`, `FOB_REQUEST_DENIED`, `FOB_INVENTORY_DEFAULT_UPDATED`, `FOB_INVENTORY_OVERRIDE_SET`, `FOB_INVENTORY_OVERRIDE_REMOVED`) are recorded in the audit log alongside the actor's role, so admin-vs-OA actions are distinguishable.

### Parking Space Reservation

- View available parking spaces for selected dates and time periods (morning, afternoon, full day)
- Reserve parking spaces
- View and manage personal parking reservations
- Cancel own reservations
- Admin can view all reservations and cancel any reservation
- Remaining parking space count displayed for selected date and time period
- Booking validation: one parking space per person per period, one space per person per day/time
- Clear error messages for reservation conflicts

### Floor Plan Maps

- Square map panel above the desk and parking lists, rendered when an admin has uploaded a floor plan for that area.
- Admin Maps tab: upload **PNG, JPEG, or SVG** floor plans (≤2 MB), click on the map to place landmarks (lift, stairs, exit, kitchen, reception, meeting room, first aid, custom) and resource markers, switch contexts between desk and parking.
- SVG uploads are sanitised on the server before storage: `<script>` elements, `on*` event-handler attributes, `<foreignObject>` blocks, and DOCTYPE-with-ENTITY declarations are removed; only the sanitised bytes are kept. The renderer always embeds the floor plan via `<img src>`, so the browser sandbox treats SVG identically to a raster image and never executes scripts in it.
- Landmarks are orientation-only and do not block clicks on resource markers.
- Desk / parking-space markers are clickable and toggle the same Select state used by the existing list, so booking flows stay consistent whether the user clicks the list or the map.
- Coordinates are stored as fractions of the floor plan image so markers stay aligned at any viewport size.

### Multi-Select Desk and Parking Booking

- Select multiple desks or parking spaces before booking
- Dual button system: **Select** (adds to selection list, true toggle) and **Book** / **Reserve** (books immediately)
- **Select acts as a toggle:** click once to add the desk or parking space to the selection (the button label changes to **Selected** and an active style is applied); click the same button again to remove it. Assistive tech sees the state via `aria-pressed`. **Clear Selection** still wipes the entire selection in one action.
- **Uniform card button sizing:** Select and Book on a desk card (and Select and Reserve on a parking card) share a single CSS class so they always render at the same width and height. Future styling changes apply to all three buttons together.
- Visual selection indicators for selected items
- "Book Selected" button books all selected items for the same date range in one operation
- Selection persists when scrolling; "Clear Selection" to deselect all
- When an item is selected the per-card Book / Reserve control is hidden (Book Selected / Reserve Selected takes its place); toggling Select off restores it
- Existing single "Book" / "Reserve" button functionality maintained

### Enhanced Admin Resource Configuration

- Auto-generate sequential desk numbers (e.g. setting 10 desks creates desks numbered 1-10)
- Auto-generate sequential parking space numbers
- Manual number assignment for specific desks and parking spaces
- Support for both auto-generated and manually assigned numbers

### Admin Dashboard

- Configure number of desks and parking spaces (with flexible numbering); the **Save Configuration** button shows an inline loading indicator while the request is in flight and is disabled to prevent duplicate submissions
- View all bookings and reservations
- Cancel any user's bookings or reservations with reason
- Manage office resources
- User management: provision users (email + name only), share profile setup links, view profile status, delete users (confirmation required)
- Last admin user cannot be deleted; related bookings and parking reservations are removed with a deleted user
- **Audit log**: append-only record of every meaningful action (logins, bookings, reservations, admin operations, user-management events) with actor, timestamp, target, summary, and payload; case-insensitive substring search; paginated list. Admin-only.

### User Dashboard

- View summary statistics (active bookings, reservations)
- Quick access to booking and reservation features
- Unified "My Bookings" view showing all personal bookings and reservations
- Search and filtering across all booking types

### Booking Matrix Screen

- Visual matrix grid: users/people on one axis, dates on the other
- Desk and parking bookings displayed with colour-coded visual indicators
- Date range selection for the matrix view
- Filtering by user, desk number, parking space number, or date range
- Hover/tooltip for booking details; click to view/edit
- Separate and combined views for desks and parking
- Export functionality (CSV)
- Admin-only access
- **Polished initial state (Phase 31):** filters live in a bordered **filter card** with the blue accent from the global theme; the content region below cycles through four explicit states — an **empty** placeholder ("Select a date range to view bookings…") on first open, a centred **loading** spinner while the request is in flight, the **loaded** matrix grid on success, and a recoverable **error** block with a **Retry** button that re-fires the same request. Subsequent reloads pass through loading → loaded/error and never drop back to the empty placeholder.

### Global Application Shell and Blue Theme

- Collapsible left sidebar navigation with active-state highlighting
- Collapsible account menu (top right): Log in / Register when anonymous; user details and Log out when authenticated
- Admin sections use vertical left sidebar (replacing former horizontal tabs)
- Blue primary colour scheme with complementary palette
- Consistent layout applied to all pages (including login, registration, profile completion)

### Deployment Version and Release History

- The running version is read from **`data/config.json`**: object **`deployment_info`**, field **`version`**, using semantic versioning with four numeric segments (default **1.0.0.0**).
- The footer shows **Version:** as a link to **Release history** (`/pages/release-history.html`), which loads text from **`data/release_history.txt`** via a public API.
- When committing a releasable change, bump **`deployment_info.version`** and append a line to **`release_history.txt`** with that version and a short change summary (see **`AGENTS.md`**).

## User Guide

### Introduction

Welcome to Office Manager. The sections below describe how to use desk bookings and parking reservations.

### Getting Started

#### Accessing the Application

1. Open your web browser
2. Go to **https://hx-hub-d-office-manager-app.azurewebsites.net/** (or the URL your administrator provides)
3. The application will authenticate you automatically

#### Navigation and layout

- **Top bar:** App title (link to Home) on the left, **menu** button to show or hide the sidebar, and **Account** on the right.
- **Left sidebar (collapsible):** Main links for most pages: **Home**, **Desk Booking**, **Parking**, **My Bookings**, **Booking Matrix**, **Admin**. Use the menu button to collapse or expand the sidebar; your choice is remembered for the session.
- **Account menu (collapsible):** Click **Account** on the right. If you are not signed in, choose **Log in** or **Register**. If you are signed in, the menu shows your name and details and a **Log out** action.
- **Admin:** Admin areas use the same shell; sections (configuration, bookings, users, and so on) are listed **vertically in the left sidebar**. **Main site** at the top of that sidebar returns to the standard app pages.
- **Footer:** The **Version** value is a link. Click it to open **Release history**, which shows the contents of **`data/release_history.txt`**.

### Desk Booking

#### Booking a Desk

1. Click **Desk Booking** in the navigation menu
2. Select your start date and end date
3. (Optional) Tick **Fob needed** if you need a building key fob alongside the desk. If your office has configured a fob inventory limit, an inline hint below shows how many fobs remain for each day in the range.
4. Click **Check Availability** to see available desks
5. Review the list of available desks
6. Click **Book This Desk** on your preferred desk
7. Confirm your booking

If you ticked **Fob needed** and no fob is available on any day in the range, the system rejects the booking with a message naming the offending date(s). Either uncheck **Fob needed** to book without a fob, or pick different dates.

#### Viewing Your Bookings

1. Click **My Bookings** in the navigation menu
2. Your active desk bookings appear in the "Desk Bookings" section
3. Each booking shows desk number and location, start and end dates, and status (active or cancelled)

#### Cancelling a Booking

1. Go to **My Bookings**
2. Find the booking you want to cancel
3. Click **Cancel**
4. Confirm the cancellation

**Note:** Once cancelled, the desk is immediately available for other users.

#### Undoing a cancellation

Immediately after you cancel one of your own desk bookings, an **Undo** toast appears at the top of **My Bookings**. Clicking **Undo** restores the booking.

- The Undo window is **30 seconds**. After that the toast disappears and the cancellation is final.
- Undo only works for cancellations **you** made. If an administrator cancelled the booking, you cannot undo it — contact the administrator instead.
- Undo may also fail if, during the 30 seconds, another user has booked the desk for the same dates. In that case you'll see a message that the desk is no longer available; the booking stays cancelled.

### Parking Reservations

#### Reserving a Parking Space

1. Click **Parking** in the navigation menu
2. Select the date you need parking
3. Choose a time period:
   - **Morning** - Typically 8 AM to 12 PM
   - **Afternoon** - Typically 1 PM to 5 PM
   - **Full Day** - Typically 8 AM to 5 PM
4. Click **Check Availability** to see available parking spaces
5. Review the list of available spaces
6. Click **Reserve This Space** on your preferred space
7. Confirm your reservation

#### Viewing Your Reservations

1. Click **My Bookings** in the navigation menu
2. Your active parking reservations appear in the "Parking Reservations" section
3. Each reservation shows space number and location, date, time period (morning, afternoon, or full day), and status (active or cancelled)

#### Cancelling a Reservation

1. Go to **My Bookings**
2. Find the reservation you want to cancel
3. Click **Cancel**
4. Confirm the cancellation

### My Bookings Page

The **My Bookings** page is a unified view of all your desk bookings and parking reservations.

- **Search** - Search across bookings and reservations
- **Filter by Status** - Active or cancelled
- **Filter by Type** - Desk bookings or parking reservations
- **Quick Actions** - Cancel bookings and reservations from the list

#### Using Search and Filters

1. Enter terms in the search box to find specific items
2. Use the **Status** dropdown to filter by status
3. Use the **Type** dropdown to filter by item type
4. Filters can be combined

### Dashboard

The **Home** page shows:

- **Active Desk Bookings** - Count of upcoming desk bookings
- **Parking Reservations** - Count of active parking reservations
- **Upcoming Items** - Your next five upcoming bookings and reservations

### Tips and Best Practices

1. **Plan ahead** - Book desks and parking in advance when possible
2. **Check availability** - Use Check Availability before booking
3. **Cancel early** - Release resources you no longer need
4. **Use search** - Search and filters help you find items quickly

### Troubleshooting

#### I can't see any available desks or parking spaces

- Check that dates are valid (not in the past where the app disallows it)
- Try different dates or time periods
- The resource may be fully booked for your selection

#### I can't cancel my booking

- Only active bookings can be cancelled
- If status is "Cancelled", it is already cancelled
- Contact an administrator if you still need help

#### Authentication errors

- Use the correct application URL
- Contact your administrator if problems continue

#### New account: profile setup from admin link

If an administrator created your account, you cannot log in until you finish setup:

1. Open the **profile setup link** they sent you (it opens **Complete your profile**)
2. If the link is missing or expired, ask your administrator for a new one
3. Choose **office location**, enter and confirm your **password**, then submit
4. When setup succeeds, sign in on the **Login** page with your **email** and the password you chose

Until profile setup is complete, protected features (bookings, parking, and similar) are not available.

### Admin Features

If you have admin privileges:

#### User management (provision new users)

1. Open the **Admin** page
2. Open the **User Management** tab
3. Enter the person's **full name** and **email** (used for login). Optionally mark **Admin user** or change **Role** as needed
4. Click **Create User**
5. Copy the **profile setup link** from the success message and send it securely to the new user (the link contains a time-limited token)
6. Until they complete setup, their row shows **Pending setup** in the Profile column

#### User management (delete users)

1. Open the **Admin** page
2. Open the **User Management** tab
3. Use **Delete** on a user row (you will be asked to confirm)
4. The **last** admin user cannot be deleted; that row shows delete disabled with an explanation
5. You cannot delete your **own** account; your row shows delete disabled. Another administrator must perform the removal if required

#### Resource Configuration

1. Open the **Admin** page
2. Open the **Resource Configuration** tab
3. Update desk count or parking count
4. Click **Save Configuration**. While the change is being saved, the button shows an inline spinner and is disabled to prevent duplicate submissions; on success it briefly shows a checkmark before returning to the idle state.

**Note:** You cannot reduce counts below the number of active bookings or reservations.

#### Viewing All Bookings

1. Open **Admin**
2. Open the **All Bookings** tab
3. View all desk bookings for all users
4. Cancel any booking with a reason if needed

#### Managing Parking Reservations

1. Open **Admin**
2. Open the **All Parking Reservations** tab
3. View all parking reservations for all users
4. Cancel any reservation with a reason if needed

#### Audit log (admin only)

The **Audit** tab records every meaningful action taken in the system — by admins and regular users alike — so you can review what happened, by whom, and when. The log is **append-only**: rows cannot be edited or deleted through the UI.

**What is logged:**
- Authentication: successful logins, logouts, and failed login attempts (wrong password or unknown email; the attempted email appears in the event payload)
- Desk bookings: create, self-cancel, admin-cancel, bulk create
- Parking reservations: create, self-cancel, admin-cancel, bulk create
- User management: account created (self-registration or admin-provisioned), account deleted, password changed (self-service or via an admin-issued reset link), profile completion after provisioning
- Admin configuration: desk / parking count changes, bulk desk or parking-space creation, manual renaming of individual desks or parking spaces

**Opening the log:**

1. Open the **Admin** page
2. Open the **Audit** tab in the sidebar (visible to admins only)
3. Rows load newest-first, 50 at a time. Use **Previous** / **Next** to page through history.

**Searching:**

1. Type into the search box and click **Search**. The match is a case-insensitive substring over the action type, the actor email, the summary, and the JSON payload — so `USER_CREATED`, a specific email, or a specific desk number all work.
2. Click **Clear** to reset back to the full list.

Each row shows:
- **When** the event occurred (server time)
- **Actor** — the user's email, or *system* for unauthenticated events like a login attempt with an unknown address
- **Action** — a stable code such as `DESK_BOOKING_CREATED`
- **Target** — the affected entity (e.g. `booking #42`)
- **Summary** — a short human-readable description
- **Payload** — structured context (never contains passwords or tokens)

### Support

For additional support, contact your system administrator.

## Technology Stack

- **Backend:** Node.js with Express
- **Database:** MySQL with raw SQL queries
- **Frontend:** HTML, CSS, JavaScript (vanilla JS)
- **Containerization:** Docker
- **Deployment:** Azure App Service

## API Documentation

For detailed API documentation and the full product specification, see `docs/spec.md`.

## Implementation Summary

All features listed in "Currently Implemented Features" above are fully functional. Key implementation phases:

- **Phases 1-6:** Core infrastructure, desk booking, parking reservations, admin functionality, integration and polish (overtime tracking built in Phase 4 was removed end-to-end in Phase 23a)
- **Phases 7-10:** Enhanced admin resource configuration (flexible numbering), user authentication and management, booking matrix screen, booking validation rules
- **Phase 11:** Comprehensive test coverage (unit, integration, and use case tests)
- **Phases 12-13:** Enhanced user management (profiles, password reset, office locations), availability display enhancement
- **Phase 14:** First user admin registration (first user becomes admin, startup cleanup)
- **Phases 15-16:** Multi-select desk/parking booking, removed booking confirmation modal
- **Phase 17:** Admin user deletion with last-admin protection and cascade handling
- **Phases 18, 22:** Version tracking with semantic versioning, config-driven deployment version, release history page
- **Phase 19:** Minimal admin provisioning (email + name only), profile completion on first login
- **Phase 20:** Global application shell with collapsible navigation and blue theme
- **Phase 21:** Administrative audit trail — append-only `audit_events` table, admin-only `GET /api/admin/audit-events` list/search API, admin UI tab, and emission from every mutating flow (authentication, bookings, parking, admin config, user management, bulk create)
- **Phase 23a:** Overtime feature removed end-to-end (APIs, UI, table, tests, docs)
- **Phase 23b:** Uniform Select/Book/Reserve/Book-selected button sizing; per-item Book/Reserve hidden when the resource is in the multi-select selection
- **Phase 23c:** Undo desk booking cancellation — toast with Undo button, 30-second server-enforced window, re-availability check, `POST /api/bookings/:id/undo-cancel`, `DESK_BOOKING_RESTORED` audit event
- **Phase 23d/e:** Floor plan maps — admin uploads a square PNG/JPEG floor plan per context (desk / parking), places landmarks (lift, stairs, exit, …) and resource markers; desk booking and parking pages render a square map panel above the list with clickable resource markers synced to the existing Select / Book state. Backend in 23d (`/api/maps/:context`, `/api/admin/maps/...`); frontend editor + per-page panels in 23e
- **Phase 24:** Natural numeric ordering — desk and parking space numbers now appear in human order (`1, 2, 3, …, 10, 11`) instead of alphabetic order (`1, 10, 11, 2, …, 9`). Implementation lives in `src/backend/utils/natural-sort.js` (and a matching frontend mirror in `src/frontend/js/natural-sort.js`); applied at the `DeskRepository.findAll{,Active}` and `ParkingSpaceRepository.findAll{,Active}` boundary so every API response is sorted, with corresponding integration / unit / Playwright coverage
- **Phase 26:** Office Administrator role — new third role between regular User and Administrator. OAs can cancel **any** user's desk booking or parking reservation but cannot create / delete users, change roles, edit resource configuration, view the audit log, or upload floor plans. Backend: idempotent migration aligning `users.role` and `users.is_admin`; `User` model derives `isAdmin` from `role === 'admin'`; `requireAdmin` and `requireOfficeAdminOrAdmin` middleware wrappers; `UserService.changeUserRole` enforces the last-admin invariant; `PUT /api/auth/users/:id/role` (admin-only) for role assignment; `DELETE /api/admin/bookings/:id` and `DELETE /api/admin/parking-reservations/:id` widened to `office_admin OR admin`; audit emission auto-injects `actor_role` from `req.user.role`. Frontend: per-row role `<select>` + Save button in **Admin → User Management** (admin-only); slimmed admin sidebar variant for Office Administrators (Bookings + Parking Reservations + Change Password only — no Resource Configuration / User Management / Audit / Maps).
- **Phase 27:** Key Fob Request and Allocation Subsystem — desk bookings carry an optional `fob_requested` flag, with configurable inventory and per-day enforcement. Phase 27a: schema (`bookings.fob_requested`, `fob_inventory` table), `Booking` model exposes `fobRequested`, `POST /api/bookings(/bulk)` accepts the flag, `FOB_REQUEST_GRANTED` audit. Phase 27b: `FobInventoryService` (default + per-date overrides + range availability), booking-time enforcement (`FobUnavailableError` -> `400 FOB_UNAVAILABLE`), six admin endpoints under `/api/admin/fob` for inventory + calendar + history (CSV), and four new audit event types (`FOB_REQUEST_DENIED`, `FOB_INVENTORY_DEFAULT_UPDATED`, `FOB_INVENTORY_OVERRIDE_SET`, `FOB_INVENTORY_OVERRIDE_REMOVED`). Phase 27c: **Fob needed** checkbox + inline per-day availability hint on the desk booking page; **Fob** badge on My Bookings rows; three admin pages (Fob Management / Fob Calendar / Fob History) plumbed into the Phase 26 sidebar variant for Office Administrators; full Playwright e2e covering the OA-sets-1, A-books, B-denied, A-cancels, B-retries loop plus the OA-views-calendar-and-history finish.
- **Phase 28:** Select-as-toggle on desk and parking cards (click adds, click again removes; label flips to **Selected** with `aria-pressed`); shared `.btn-card-action` CSS class so Select / Book / Reserve render at identical width and height (corrects a Phase 23.12 regression where Book sat 1.5rem above Select on the desk page).
- **Phase 29:** Inline loading animation on the admin **Save Configuration** button — CSS-only spinner via `runWithButtonSpinner` in `src/frontend/js/admin.js`, `aria-busy` flips to `true` during the parallel desk + parking count requests.
- **Phase 30:** Consistent vertical alignment of form controls and adjacent action buttons via a single shared `.form-row` class. Applied to the booking, filter, and admin search rows on the parking, desk-booking, My Bookings, Booking Matrix, and Admin pages; the rule zeros `.form-group { margin-bottom }` inside the row so labelled inputs and unlabelled buttons share the same baseline. Frontend Jest covers the structural contract (`src/frontend/tests/form-row-alignment.test.js`); Playwright (`tests/e2e/form-row-alignment.spec.js`) asserts real-pixel bottom-edge alignment within a 1px tolerance.
- **Phase 31:** Booking Matrix initial-state polish. The filter inputs sit in a bordered `.matrix-filter-card` (blue accent + the Phase 30 `.form-row`); `#matrix-region` cycles between four mutually-exclusive states (`empty | loading | loaded | error`) driven by `setMatrixState()` in `src/frontend/js/matrix.js`. The error state exposes a Retry button that re-fires the same request. Subsequent reloads go loading → loaded/error and never drop back to empty. Frontend Jest covers the four transitions including Retry (`src/frontend/tests/matrix.test.js`); a Playwright spec exercises the full lifecycle in a real browser, forcing the failure path with `page.route` (`tests/e2e/matrix-states.spec.js`).
