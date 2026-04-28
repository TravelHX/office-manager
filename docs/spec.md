# Office Manager

## Document Purpose

This file (`docs/spec.md`) is the **product specification**. It describes the **intended functionality** of Office Manager: what the system is meant to do, how it should behave, and what capabilities it should offer (including features not yet built). It is not a task list; for work items see `docs/todo.md`. For what is **already implemented and deployed**, see `README.md` in the project root.

## Project Overview

Office Manager is a web application designed to manage office operations and resources. The application provides tools for tracking and managing **desk bookings** and **parking space reservations**. Overtime tracking was previously part of the product and was removed end-to-end in Phase 23a; see section 16 below.

## Purpose

The primary purpose of Office Manager is to provide a centralized system for managing day-to-day office operations. The application helps organizations:

- Track and manage desk bookings to optimize office space utilization
- Monitor parking space availability and assignments

Overtime recording was previously supported and was removed end-to-end in Phase 23a; it is no longer a capability of the product.

## Technology Stack

- **Backend:** Node.js
- **Database:** MySQL
- **Data Access:** Raw SQL queries (no ORM) in a dedicated data access layer
- **Frontend:** HTML, CSS, JavaScript (vanilla JS)
- **API:** RESTful API using Node.js HTTP server
- **Containerization:** Docker (all services run in Docker containers)

## Architecture Overview

The application follows a layered architecture with separation of concerns between different components:

- **Controllers/Handlers:** Handle HTTP requests and responses (Node.js routes/handlers)
- **Services:** Contain business logic (Node.js service modules)
- **Data Access Layer:** Raw SQL queries using MySQL connection pool (no ORM)
- **Models/DTOs:** Data models and Data Transfer Objects for API communication
- **Frontend:** HTML/CSS/JavaScript client-side application

The data access layer uses raw SQL queries executed through MySQL connection pools, providing direct control over database operations without ORM abstraction.

## Setup Instructions

### Prerequisites

- Docker (v20.10 or higher)
- Docker Compose (v2.0 or higher)
- Git

### Installation Steps

1. Clone the repository
2. Navigate to the project directory
3. Build and start all services using Docker Compose:
   ```
   docker-compose up -d
   ```
4. Wait for all containers to be healthy (database initialized, backend started)
5. Access the application:
   - Frontend: Open in web browser at the configured port
   - Backend API: Available at the configured API port
   - Database: Accessible via the configured MySQL port

### Docker Services

The application runs entirely in Docker containers:

- **Backend Container:** Node.js application server
- **Database Container:** MySQL server
- **Test Environment Container:** Separate MySQL instance for running tests

### Running the Application

- Start all services: `docker-compose up -d`
- Stop all services: `docker-compose down`
- View logs: `docker-compose logs -f`
- Rebuild containers: `docker-compose up -d --build`

### Running Tests

Tests run in Docker containers with a dedicated test database:

- Run all tests: `docker-compose -f docker-compose.test.yml up --abort-on-container-exit`
- Or use test scripts in the `utils/` directory

### Configuration

Configuration is managed through Docker environment variables and `.env` files:

- Database connection settings (host, port, database name, username, password)
- Server port configuration
- Environment-specific settings (development, production, test)
- Docker Compose configuration files for different environments

## Currently Implemented

### Phase 1: Project Setup and Infrastructure (Completed)

The project foundation has been established with the following components:

- **Docker Setup**: Complete Docker configuration with Dockerfile, docker-compose.yml for development, and docker-compose.test.yml for testing
- **Node.js Project**: Initialized with package.json, Express server, and all required dependencies
- **Database Infrastructure**: MySQL connection pooling with raw SQL query execution
- **Project Structure**: Organized directory structure with separation of concerns:
  - `src/backend/` - Backend source code (config, database, data-access, middleware, routes, services, utils)
  - `src/frontend/` - Frontend source code (HTML, CSS, JavaScript)
  - `src/sql/` - Database initialization and schema scripts
  - `tests/` - Test files with Jest configuration
  - `utils/` - Utility scripts for Docker and testing
- **Data Access Layer**: Base repository pattern using raw SQL queries
- **API Infrastructure**: Express server with routing, error handling, and logging
- **Authentication Middleware**: Authentication and authorization middleware with role-based access control
- **Testing Framework**: Jest configured with test database setup utilities
- **Frontend Foundation**: Base HTML templates, CSS framework, and JavaScript structure
- **Configuration Management**: Environment variable configuration system (Docker-aware)

### Phase 2: Desk Booking Feature (Completed)

Complete desk booking system with the following capabilities:

- **Database Schema**: `desks` and `bookings` tables with proper relationships and indexes
- **Models & Repositories**: Desk and Booking models with repositories using raw SQL queries
- **Business Logic**: DeskService and BookingService with availability checking and conflict detection
- **API Endpoints**: RESTful endpoints for desk management and booking operations
- **Frontend UI**: Complete desk booking interface with date selection, availability checking, and booking submission
- **Testing**: Unit tests, integration tests, and use case validation tests

**Related Use Cases:** Use Case 1 (Employee Books Desk for Two Days), Use Case 3 (Employee Attempts to Book Unavailable Desk), Use Case 6 (User Cancels Their Own Desk Booking)

### Phase 3: Parking Tracking Feature (Completed)

Complete parking space reservation system with half-day support:

- **Database Schema**: `parking_spaces` and `parking_reservations` tables with time period support (morning, afternoon, full_day)
- **Models & Repositories**: ParkingSpace and ParkingReservation models with conflict detection for time periods
- **Business Logic**: ParkingSpaceService and ParkingReservationService with time period validation
- **API Endpoints**: RESTful endpoints for parking space management and reservation operations
- **Frontend UI**: Complete parking reservation interface with date and time period selection
- **Testing**: Unit tests, integration tests, and use case validation tests

**Related Use Cases:** Use Case 2 (Employee Books Desk and Parking Space for Half Day)

### Phase 4: Overtime Tracking Feature (Removed in Phase 23a)

Overtime tracking was built historically and **removed end-to-end** in Phase 23a: API routes, services, repositories, models, frontend pages, admin tab, dashboard cards, My Bookings sections, database table, and all related tests are deleted. Operators who need a historical copy of `overtime_records` must capture a database backup before upgrading past the Phase 23a release; see `docs/technical-notes-phase23-overtime-removal.md`.

### Phase 5: Admin Functionality (Completed)

Complete administrative features for resource and booking management:

- **Database Schema**: `admin_config` table for configuration management
- **Models & Repositories**: AdminConfiguration model and repository
- **Business Logic**: AdminService with validation to prevent reducing counts below active bookings
- **API Endpoints**: RESTful endpoints for configuration management and admin booking operations
- **Frontend UI**: Admin dashboard with configuration, bookings, and parking management
- **Authentication**: Role-based access control with admin authorization checks
- **Testing**: Unit tests, integration tests, and use case validation tests

**Related Use Cases:** Use Case 4 (Admin Sets Up Number of Desks and Parking Spaces), Use Case 5 (Admin Cancels User Desk Booking)

**Note:** Enhanced features for flexible desk/parking number assignment are planned (see "Not Yet Implemented" section).

### Phase 6: Integration and Polish (Completed)

Integration and polish features:

- **User Dashboard**: Home page dashboard showing summary statistics (active bookings, reservations)
- **Search & Filtering**: Search and filter functionality across bookings and reservations
- **Notification System**: Client-side notification system for success, error, info, and warning messages
- **Unified My Bookings View**: Integrated view showing desk bookings and parking reservations
- **Navigation**: Consistent navigation across all pages
- **Documentation**: API and product specification in this file (`docs/spec.md`); end-user documentation in root `README.md` (User Guide section)

## Not Yet Implemented

The following features are planned for implementation:

### 1. Enhanced Admin Resource Configuration

Enhanced administrative features for configuring desks and parking spaces with flexible numbering options:
- **Auto-Generate Numbers**: Option to automatically generate sequential numbers (e.g., setting 10 desks will create desks numbered 1-10)
- **Manual Number Assignment**: Option to manually assign specific numbers to specific desks/parking spaces
- **Mixed Configuration**: Support for both auto-generated and manually assigned numbers in the same configuration

This feature will improve the admin experience when setting up office resources by providing flexibility in how desk and parking space numbers are assigned.

### 2. Enhanced Desk Display

Improved desk booking display to show desk numbers prominently:
- Display desk number prominently when viewing available desks
- Show desk number in booking confirmation messages
- Display desk number in "My Bookings" view for easy identification

This feature will make it easier for users to identify which desk they have booked.

### 3. Admin Desk Number Display

Display desk numbers in the admin screen after desks are allocated:
- Show all allocated desk numbers in the admin dashboard
- Display desk numbers in admin booking management view
- List desk numbers when viewing desk configuration

This feature will help administrators quickly see which desk numbers have been assigned and are available in the system.

### 4. User Authentication and Management

Complete user authentication and management system with role-based access control:

- **Email as Username**: Email address serves as the username/login identifier. No separate username field is required - users log in using their email address.
- **User Creation**: Admin users **provision** new users with **email address** (login identifier) and **name** only. Password, office location, and other profile fields are **not** set by the admin; the user completes them immediately after signing in on the login page (see **### 13**). The application **does not send email**; optional setup URLs may be copied by the admin and shared out of band.
- **Password Management**: Users can change their passwords
- **Admin Configuration**: Initial admin user configured via `config.json` in the `data/` folder with configurable email address (used as username) and optional password
- **User Restrictions**: Users can only book desks/spaces for themselves and update their own data
- **Development Test User**: Test user (Email: test@example.com or similar, Password: Password123) created automatically in development mode only (to be removed - see First User Admin Registration feature)
- **User Indicator**: Icon at top left of screen displays logged-in user information
- **Access Control**: 
  - Logged-in users: Full access to all features except **user management** (adding and removing users; **admin only**)
  - Not logged-in users: Can only view available desks/spaces and cannot make bookings
- **Login Redirect**: Unauthenticated users attempting to book desks/spaces are redirected to login screen

This feature will provide secure user authentication and proper access control throughout the application.

### 4a. Enhanced User Management

Enhanced user management system with comprehensive user profiles and password recovery:

- **User Profile Fields**: Email address is the login identifier (no separate username). Full name is stored from registration or from admin provisioning plus profile completion. Office location is chosen by the user (London or Prague) when they complete their profile after provisioning or at registration.
- **Office Location**: Hardcoded list of office locations (currently London or Prague)
- **Admin Flag**: Users have an `IsAdmin` boolean flag to designate administrative privileges
- **Admin user management (add and remove)**: **Only administrators** may **add** (provision) users and **remove** (delete) users. An admin **must not** be allowed to **remove their own account** (self-deletion is forbidden); another admin must perform removal of a given admin account if required.
- **Minimum admin invariant**: The system **must always** have **at least one** user with administrative privileges. No operation (including deletion or role change) may leave the system with zero admins. This is enforced in validation and API behavior (see **### 10**).
- **Admin User Creation**: Admin users provision new users with **email and name only** through the admin interface; the user sets password and office via the profile setup link (see **### 13**). Self-registration (first user and subsequent users where enabled) collects email, password, name, and office as implemented for that flow.
- **Login Screen**: Dedicated login screen for user authentication using email address as the username/login identifier
- **Password Reset**: Forgotten password functionality that emails a reset link to the user's email address
- **Admin Setup Script**: Utility script to add initial admin user (paul.michaels@travelhx.com) with admin privileges

This feature will provide a complete user management system with proper user profiles, role management, and password recovery capabilities.

### 4b. First User Admin Registration

**Status:** Implemented (Phase 14). See root `README.md` user guide and the Currently Implemented overview. Remaining optional items: end-to-end coverage via Playwright, deferred where Playwright is not in CI (API-level end-to-end coverage exists under `tests/integration/authentication.test.js`).

Initial user registration system where the first user to register automatically becomes an admin:

- **First User Admin**: The first user to register in the system automatically receives admin privileges (IsAdmin flag set to true)
- **No Users Detection**: When navigating to the site with no registered users, display a registration screen informing users that they can register to become the first admin
- **Application Startup Cleanup**: When the application starts, it automatically runs cleanup logic that:
  - Removes the admin/password123 test user if it exists
  - If the "admin" user exists, flushes all users from the system (clean slate for production)
- **Registration Flow**: When no users exist, users are presented with a registration screen instead of login screen. When any user already exists, self-registration is **not** available; the registration API returns **403 `REGISTRATION_CLOSED`** and the registration page hides the form and shows an informational message directing visitors to log in or contact an administrator.
- **Automatic Admin Assignment**: The first registered user is automatically assigned admin privileges without manual intervention; subsequent users provisioned by an administrator are created as non-admin by default unless the administrator explicitly flags them as admin.

This feature will provide a clean initialization process where the first user becomes the admin, removing the need for manual admin setup scripts in production.

### 5. Booking Matrix Screen

Visual matrix display showing desk and parking bookings organized by people and dates:
- **Matrix View**: Grid layout with users/people on one axis and dates on the other axis
- **Desk Bookings**: Display desk bookings in the matrix showing which user has booked which desk on which date
- **Parking Bookings**: Display parking space bookings in the matrix showing which user has reserved which parking space on which date
- **Date Range Selection**: Ability to select date ranges for the matrix view
- **Filtering Options**: Filter by user, desk number, parking space number, or date range
- **Visual Indicators**: Color coding or visual markers to distinguish between desk and parking bookings
- **Admin Access**: Matrix view accessible to admin users for comprehensive booking overview

This feature will help administrators and users quickly visualize booking patterns, identify conflicts, and understand resource utilization across time and people.

### 6. Booking Validation Rules

Enhanced validation rules to prevent booking conflicts and ensure fair resource allocation:

- **One Desk Per Person Per Period**: A person cannot book more than one desk for overlapping time periods
  - Validation checks for any date overlap between bookings
  - If a user tries to book a second desk for dates that overlap with an existing booking, the reservation fails
  - Error message clearly states the reason: "Overlapping booking - you already have a desk booked for this period"
  - Applies to both single-day and multi-day bookings
  - Partial overlaps are detected (e.g., booking desk 1 for 5/2/2026 and desk 2 for 4/2/2026-6/2/2026 would fail due to overlap on 5/2/2026)

- **One Person Per Desk Per Day**: A single desk cannot be booked by more than one person for the same day
  - Validation ensures desk exclusivity per day
  - If a desk is already booked by one person for a date, another person cannot book the same desk for that date
  - Error message indicates the desk is already booked for the requested date(s)

- **Same Rules for Parking**: Both validation rules apply equally to parking space reservations
  - A person cannot reserve multiple parking spaces for overlapping periods
  - A parking space cannot be reserved by multiple people for the same day/time period

- **Clear Error Messages**: All validation failures provide clear, user-friendly error messages explaining why the booking failed

This feature will prevent double-booking conflicts and ensure fair access to office resources.

### 7. Availability Display Enhancement

Enhanced availability display showing remaining spaces when selecting dates for booking:

- **Remaining Spaces Counter**: When selecting a day to book a desk or parking space, the screen displays the number of spaces remaining
- **Real-Time Availability**: The count updates based on the selected date(s) and shows current availability
- **Desk Availability**: Shows how many desks are still available for the selected date range
- **Parking Availability**: Shows how many parking spaces are still available for the selected date and time period
- **Visual Indicator**: Clear display of remaining spaces to help users understand availability at a glance

This feature will improve user experience by providing immediate visibility into resource availability when making booking decisions.

### 8. Multi-Select Desk and Parking Booking

**Status:** Implemented (Phase 15). The desk and parking pages expose per-card **Select** and **Book**/**Reserve** buttons with a **Book Selected** / **Reserve Selected** action and a **Clear Selection** control; bulk booking is served by `POST /api/bookings/bulk` and `POST /api/parking-reservations/bulk`. Jest coverage is in `src/frontend/tests/desk-booking.test.js` and `src/frontend/tests/parking-multiselect.test.js`; API coverage is in `tests/integration/desk-booking.test.js` and `tests/integration/parking-tracking.test.js`. Remaining optional items: Playwright end-to-end coverage (deferred where Playwright is not in CI). **Alignment with section 19** (hide per-item Book/Reserve when selected, uniform button sizing) is scheduled under Phase 23.12.

Enhanced booking interface allowing users to select and book multiple desks or parking spaces at once:

- **Multi-Select Functionality**: Users can select multiple desks or parking spaces before booking
- **Dual Button System**: Each desk and parking space has two buttons:
  - **"Select" Button**: Adds the desk/space to a selection list (checkbox-style selection for multi-booking)
  - **"Book" Button**: Books only that specific desk/space immediately (existing single-booking behavior)
- **Visual Selection Indicator**: Selected desks/spaces are visually marked (e.g., highlighted, checked, or ticked)
- **Book Selected Button**: A "Book Selected" button appears at the bottom of the list when one or more desks/spaces are selected
- **Bulk Booking**: The "Book Selected" button books all selected desks/spaces for the same date range/time period in a single operation
- **Selection Persistence**: Selected items remain selected when scrolling or navigating the list
- **Clear Selection**: Ability to clear all selections or deselect individual items

**Alignment with section 19:** When an item is **selected**, the immediate **Book/Reserve** control for that item must **not** appear; uniform button sizing applies across Select, Book, Reserve, and Book selected.

This feature will improve efficiency for users who need to book multiple resources at once, while maintaining the existing single-booking functionality.

### 9. Remove Booking Confirmation Modal

Simplified booking flow by removing the unnecessary modal dialog:

- **Direct Booking**: When users click "Book" on a desk or parking space, the booking is created immediately without showing a confirmation modal
- **Streamlined UX**: Removes an extra step in the booking process, making it faster and more efficient
- **Success Feedback**: Booking success is indicated through other means (e.g., success message, visual update, or redirect) without requiring modal confirmation
- **Error Handling**: Errors are still displayed appropriately without using a modal dialog

This feature will streamline the booking process by removing an unnecessary confirmation step, making bookings faster and more intuitive.

### 10. Admin User Deletion and Admin Invariants

Administrative functionality to **add** and **remove** users, with mandatory safety rules:

- **Who may add or remove users**: **Only admin users** have permission to **provision (add)** users and to **delete (remove)** users. Non-admins cannot add or remove user accounts.
- **Self-removal forbidden**: An admin **must not** be able to **delete their own** user account. The UI and API must reject attempts to remove the currently authenticated admin as the target of deletion, with a clear error message. Removing a given admin account (if needed) is performed by **another** administrator.
- **At least one admin (system invariant)**: There **must always be** at least **one** admin user in the system at all times. No sequence of operations may result in zero users holding administrative privileges.
  - Deleting or demoting the **last** remaining admin is **not** allowed; validation blocks it with an appropriate error message.
  - Deleting **another** admin is allowed only when **at least one** admin will remain afterward.
- **Regular users**: Admins may delete non-admin users subject to cascade and business rules below.
- **Error Handling**: Clear error messages when deletion is prevented (self-deletion, last admin, or other validation failures).
- **Cascade Handling**: Determine how to handle bookings and reservations associated with deleted users (e.g., mark as cancelled, reassign, or prevent deletion if active bookings exist).

This feature provides administrators with user lifecycle management while enforcing **no self-deletion** and the **minimum one admin** rule.

### 11. Comprehensive Test Coverage

Comprehensive test coverage requirements to ensure quality and reliability:

- **End-to-End Test Coverage**: Each use case and feature must be covered by at least one end-to-end test
  - All documented use cases in `docs/usecases.md` must have corresponding end-to-end tests
  - All implemented features must have at least one end-to-end test validating the complete user flow
  - End-to-end tests should be written using Playwright
  - Tests should validate the complete user interaction flow from start to finish

- **Unit Test Coverage**: Where feasible, all units of functionality should be covered by unit tests
  - All business logic services should have comprehensive unit test coverage
  - All repository methods should have unit tests
  - All utility functions and helper methods should have unit tests
  - All API endpoints should have unit tests for their handlers
  - Test coverage should aim for high coverage of critical business logic paths

- **Test Quality Standards**:
  - Tests must be idempotent (can run multiple times in any order without side effects)
  - Each test should cover a single, discrete piece of functionality
  - Tests should use meaningful names that describe the scenario
  - Tests must validate real behavior, not test-only code paths
  - Test-first development approach: write tests before implementing features

- **Test Maintenance**:
  - Tests should be updated when features or use cases are modified
  - Review existing tests when adding new tests to avoid duplication
  - All tests must pass before any code is committed

This feature will ensure the application maintains high quality standards and reliability through comprehensive test coverage.

### 12. Version Tracking and Management

**Status:** Implemented (Phase 18). End-to-end validation coverage lives in `tests/integration/version-phase18.test.js` (backend deployment flow, startup sync, increments, error paths, semantic-version enforcement) and `src/frontend/tests/version.test.js` (client footer, localStorage config, error display). Remaining optional items: Playwright end-to-end for the footer release-history link is tracked under Phase 22.9.

Automatic version tracking aligned with deployment configuration and history:

- **Semantic versioning**: Version numbers use **MAJOR.MINOR.PATCH** or **MAJOR.MINOR.PATCH.REVISION** (four numeric segments). The canonical displayed form uses four segments (e.g. `1.2.3.0`). Default when unset: **1.0.0.0**.
- **Source of truth**: The running version shown in the UI and returned by **GET /api/version** comes from **`data/config.json`** under **`deployment_info.version`**. Admin version update APIs also write this value so the file and database stay aligned.
- **Database storage**: Version metadata remains in the database table for auditing and startup sync when the config value differs from the stored row.
- **Startup version update**: On startup, if the config version differs from the latest database row, the database is updated to match the config.
- **Error handling**: If version initialization fails, the error is logged and a safe default version is used; the application continues to start where implemented.
- **Release history**: Human-readable release notes are maintained in **`data/release_history.txt`**. A public **Release history** page loads this file via **GET /api/release-history** and displays its contents.
- **Footer**: The version shown in the footer is a link to the Release history page.

Process expectation: when preparing a commit that should ship as a new build, maintainers bump **`deployment_info.version`** appropriately and append an entry to **`release_history.txt`** (see project `AGENTS.md` for the full workflow).

### 13. Minimal Admin User Provisioning and First-Login Profile Completion

Intended behavior for bringing new users into the system with minimal admin effort and completing sensitive or personal data only when the user signs in themselves.

- **Admin input only**: When creating a new user, the admin enters **email address** (used as the login identifier) and **name** only. The admin does **not** set the user's password, office location, or other personal profile fields at creation time.

- **Provisioned account state**: Newly created users are in a state that reflects **incomplete profile** (or equivalent), such as: no usable password set yet, or profile completion flag false, as implemented. The exact mechanics (e.g. invitation link, first password set flow, or integration with an enterprise identity provider) are implementation choices, but the **user experience** must be: the person authenticates (or validates their email) and is then prompted to supply what the admin did not enter.

- **First-login (or first authenticated session) onboarding**: After the user signs in for the first time (per the chosen authentication approach), they must be guided through collecting at least:
  - **Password** (when the application uses local passwords)
  - **Office location** (and any other required profile fields defined elsewhere in this specification)
  - Optional: confirm or adjust **name** if the implementation allows the user to correct how they are displayed

- **Access until complete**: Users with an incomplete profile must **not** have full access to actions that require a complete identity (e.g. making desk or parking bookings, or other protected features as defined during implementation). Viewing limited public or informational screens may be allowed if appropriate; the goal is to force completion before normal use.

- **Security and abuse**: Setup and reset tokens are **time-limited** and unguessable. The product may assume a trusted network or admin-controlled distribution of optional setup URLs. **Outbound email is not used** for invitations or password reset in the current product scope.

- **Existing users**: Users who already have a full profile are unaffected. Migrations must define behavior for any existing rows (e.g. treat as profile complete).

This feature reduces admin burden and ensures passwords and office choices are owned by the end user.

### 14. Global Application Shell, Navigation, and Visual Theme

Consistent layout and styling across every page of the application.

- **Left navigation (collapsible)**: Primary navigation appears as a **vertical menu on the left** of the screen. The menu can be **collapsed** (e.g. hidden or minimized via a control, with state remembered where appropriate) so more space is available for content. On the **Admin** dashboard, the former horizontal tab strip becomes this **left-hand vertical** menu so admin sections behave like the rest of the site.

- **Right account area (collapsible)**: The **top-right** of the shell hosts an **account control** that expands/collapses a small menu. When **no user is logged in**, **Log in** (and other appropriate links such as Register on auth pages) appear in that menu. When **logged in**, the trigger shows the current user; the menu contains **user details** (e.g. name, email, office, admin indicator where applicable) and **Log out** as options **under** the user identity, not as a duplicate top-level bar item.

- **System-wide consistency**: The same shell (top bar + left nav pattern + right account menu) and interaction patterns apply to **all** pages, including login, registration, password reset, profile completion, and error-style views, with only the **contents** of the left nav varying where necessary (e.g. admin vs standard app).

- **Colour scheme**: **Blue** is the **primary** brand colour (headers, key actions, active states). **Complementary** colours (e.g. teal or blue-gray accents, neutral surfaces) support readability and hierarchy without clashing with the primary blue.

### 15. Administrative Audit Trail

**Status:** Implemented (Phase 21). The audit event store (schema, model, repository, service) shipped in Phase 21a; the admin-only list/search API in Phase 21b; the admin UI (sidebar + table + search + pagination) in Phase 21c; emission from all mutating flows in Phase 21d. See `docs/audit-events.md` for the authoritative event catalogue, and root `README.md` (User Guide → Admin Features → Audit log) for the administrator flow.

A durable **audit log** of significant user and system-facing actions for compliance, support, and security review.

- **Admin-only access**: A dedicated **Audit** tab is available in the admin dashboard and is **only visible to administrators**. The server enforces admin-only access on `GET /api/admin/audit-events` (401 when unauthenticated, 403 for non-admin callers). The frontend hides the Audit sidebar link until `serverAllowsUserManagement()` confirms the caller is admin.

- **Scope of tracking**: The catalogue in `docs/audit-events.md` is the single source of truth. Current live emission sites:
  - **Authentication**: `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE` (captures both wrong-password and unknown-user attempts), `AUTH_LOGOUT`.
  - **Desk bookings**: `DESK_BOOKING_CREATED`, `DESK_BOOKING_CANCELLED_BY_USER`, `DESK_BOOKING_CANCELLED_BY_ADMIN`, `DESK_BOOKING_BULK_CREATED`.
  - **Parking**: `PARKING_RESERVATION_CREATED`, `PARKING_RESERVATION_CANCELLED_BY_USER`, `PARKING_RESERVATION_CANCELLED_BY_ADMIN`, `PARKING_RESERVATION_BULK_CREATED`.
  - **Admin configuration**: `ADMIN_CONFIG_UPDATED` (desk/parking count + bulk creation), `DESK_CONFIG_UPDATED` and `PARKING_CONFIG_UPDATED` (manual renames of individual resources).
  - **User management**: `USER_CREATED` (self-registration and admin provisioning), `USER_DELETED`, `USER_PASSWORD_CHANGED` (self-service and admin-issued reset), `USER_PROFILE_COMPLETED`.

- **Actors**: Every event records `actor_id` and a snapshot of `actor_email` at the time of the action, so a user deleted later is still identifiable. System events (e.g. login failures for unknown users) record `actor_id = NULL` and place the attempted identifier in the payload.

- **Event model**: Columns: `id`, `occurred_at` (server-issued `TIMESTAMP`, default `CURRENT_TIMESTAMP`), `actor_id`, `actor_email`, `action_type` (catalogue code, e.g. `DESK_BOOKING_CREATED`), `target_type`, `target_id`, `summary` (short human-readable), `payload` (JSON, secret-free), `ip_address`. See `src/sql/08-audit-events-schema.sql`.

- **Search (admin UI)**: The Audit tab has a single search box plus limit/offset pagination. Search is a **case-insensitive substring match** across `action_type`, `actor_email`, `summary`, and the stringified `payload`. Date-range and action-type filters are deferred; a follow-up task can add them without schema changes.

- **Performance and retention**: The `audit_events` table has indexes on `occurred_at`, `actor_id`, and `action_type`. Retention is currently unbounded; the catalogue file documents the expected follow-up (configurable purge job) and the operator-run SQL escape hatch.

- **API**: `GET /api/admin/audit-events?limit=&offset=&search=` (admin only). `limit` defaults to 50, caps at 500; `offset` defaults to 0. Response: `{ events, limit, offset }`, events as camelCase JSON. See the **Admin Endpoints** section below.

- **Integrity**: Records are **append-only** at the repository level — `update` and `delete` on `AuditEventRepository` throw explicit errors. There is no API path, UI path, or service path to edit or remove an audit row. Direct SQL access (operator tooling) is the only mechanism, and such administrative purge is expected to itself be auditable when added.

### 16. Removal of Overtime Feature (Delivered in Phase 23a)

The overtime capability was **removed end-to-end from the product** in Phase 23a:

- **No overtime UI**: The Overtime page, the overtime dashboard card, overtime rows in My Bookings, the admin overtime tab, and overtime links in navigation and shell are all deleted.
- **No overtime APIs**: `/api/overtime/*` routes and the admin `/api/admin/overtime-records` endpoint are removed; requests return 404.
- **Data**: The `overtime_records` table is dropped by an idempotent step in `src/backend/database/migrations.js`. Operators who need a historical copy must back up the table before upgrading past Phase 23a (see `docs/technical-notes-phase23-overtime-removal.md`).
- **Cross-features**: Booking matrix, dashboard summaries, the profile-complete restrictions, and every test that previously referenced overtime have been updated.
- **Documentation**: `README.md`, `docs/usecases.md`, `docs/audit-events.md`, and this specification have been aligned with the removal.

### 17. Floor Plan Map for Desk and Parking Selection

**Status:** Implemented (Phase 23d backend + Phase 23e UI). The admin editor lives in the **Maps** tab on the admin page; the desk booking and parking pages each render a square map panel above their lists, synced with the existing availability + selection state. See root `README.md` for the user / admin guide and `docs/audit-events.md` for the `MAP_*` event catalogue.

Visual **map** (floor plan) support for choosing desks and parking spaces:

- **Two contexts**: A **desk** map on the desk booking flow and a **carpark** map on the parking reservation flow. Each context has its own **floor plan image** and map metadata (they may show the same physical image only if the product is configured that way).
- **Square map area (2a)**: The map is displayed in a **square** viewport (equal width and height, e.g. `aspect-ratio: 1 / 1` with responsive width). The floor plan image **fits inside** the square (e.g. `object-fit: contain`) so the diagram is not distorted.
- **Floor plan image (2d)**: Admins can **upload** a replacement floor plan as **PNG or JPG** only (validate MIME/extension and a reasonable maximum file size). Stored server-side in a documented location (e.g. under `data/` or configured storage); prior image replaced or versioned per implementation notes.
- **Landmarks (2b, 2c)**: Admins can place **landmark markers** on the map (types such as **toilet**, **lift**, **stairs**, **exit**, **kitchen**, plus optional **custom label**). Landmarks are **for orientation only**: they **must not** intercept or block clicks on **desk** or **parking** markers (e.g. lower z-index, pointer-events, or hit-test rules). End users **see** landmarks but **cannot** edit them. **Only administrators** can add, move, edit, or delete landmarks and upload or replace the floor plan (2c).
- **Resource markers**: Desks and parking spaces appear on the map at **admin-defined positions** (normalized coordinates, e.g. fractions of image width/height) so they stay aligned when the square viewport scales. Selecting or booking from the map must stay consistent with list-based flows and existing validation rules.
- **Accessibility**: Map interactions should have a non-map fallback (existing list) where practical; keyboard focus order documented where implemented.

### 18. Undo Desk Booking Cancellation

**Status:** Implemented (Phase 23c). See root `README.md` (Desk Booking → Undoing a cancellation), `docs/audit-events.md` (`DESK_BOOKING_RESTORED`), and the Admin Endpoints list below for `POST /api/bookings/:id/undo-cancel`.

When a user **cancels** their own desk booking:

- The UI shows an **immediate Undo** affordance — a toast with an **Undo** button that appears on the My Bookings page immediately after the cancel succeeds. The toast auto-dismisses when the undo window expires. The `DELETE /api/bookings/:id` response also carries an `X-Undo-Window-Ms` header so the client-side timer stays in sync with the server rule if the duration is tuned.
- **Undo** restores the booking **only if** still allowed: within a **short time window** (current implementation: **30 seconds** — `BookingService.UNDO_CANCEL_WINDOW_MS`) **and** the desk remains **available** for those dates (no conflicting booking created in the meantime). The client posts `POST /api/bookings/:id/undo-cancel` with a Bearer token; the server re-checks ownership, the window, and desk availability atomically before flipping `status` back to `active` and clearing `cancelled_at` / `cancelled_by` / `cancellation_reason`.
- If Undo expires or is not possible, the user sees a clear error message and the booking remains cancelled. Specific server responses:
  - `400 UNDO_EXPIRED` — time window has elapsed
  - `409 DESK_UNAVAILABLE` — another booking has taken the desk during the window
  - `403 FORBIDDEN` — caller isn't the booking's owner, or the cancel was admin-initiated
- Admin cancellation of another user's booking **does not** require this Undo pattern — admin cancels are explicitly excluded from the undo path (initial scope: **user self-cancel** only).
- The restore action emits a `DESK_BOOKING_RESTORED` audit event, mirroring the `DESK_BOOKING_CREATED` / `DESK_BOOKING_CANCELLED_BY_USER` catalogue entries.

### 19. Consistent Booking Action Buttons and Selection Mode

On desk booking and parking reservation screens that use **Select** plus **immediate Book/Reserve**:

- **Uniform button sizing (4)**: **Select**, **Book**, **Reserve**, and **Book selected** (and equivalent primary actions in that flow) use **consistent** dimensions (same min-height and min-width or shared button class) so the layout is not confusing.
- **Selection vs immediate action (4)**: When a desk or parking space is **currently selected** for multi-select, the **per-item immediate Book/Reserve** control for that item is **hidden** (or disabled with no duplicate primary action). The user books via **Book selected** / bulk action only for selected items. Items that are **not** selected continue to show the immediate Book/Reserve control as today.

This supersedes ambiguous UX where mixed button sizes and simultaneous "selected" plus "book this one" compete.

### 20. Numeric Sorting of Desks and Parking Spaces

Desk and parking space lists must be sorted in **natural numeric order**, not alphabetic (string) order. The current behaviour sorts numeric identifiers as strings, producing an incorrect sequence (e.g. `1, 10, 11, 2, 3` instead of `1, 2, 3, 10, 11`).

- **Required order**: Purely numeric identifiers are ordered by **numeric value** (`1, 2, 3, ..., 9, 10, 11, ...`). Identifiers that mix letters and numbers (possible under manual assignment) use **natural sort** so that embedded numeric runs are compared as numbers (e.g. `A1, A2, A10, B1`).
- **Scope of application**: The numeric ordering applies **everywhere** a desk or parking space is listed or displayed, including:
  - Desk selection list on the desk booking page
  - Parking space selection list on the parking reservation page
  - Admin **Desk Configuration** and **Parking Configuration** views (listing all desks / spaces and their numbers)
  - Admin **All Bookings** and **All Parking Reservations** views when grouped or sorted by resource number
  - **Booking Matrix** resource axis labels
  - **My Bookings** listings of desk bookings and parking reservations
  - Any dropdowns, selectors, or filter controls that list desks or parking spaces
- **Consistency**: The same ordering is produced whether the sort is performed **server-side** (SQL) or **client-side** (JavaScript). Implementations must not mix sort strategies that yield different orders across views.
- **Stability**: Ties (e.g. identical numeric parts) fall back to a deterministic secondary order (e.g. original string comparison, creation date, or id) so results are stable between requests.

This feature ensures resource lists are presented in an intuitive, human-friendly order across the entire application.

### 21. Office Administrator Role

**Status (Phase 26a, backend):** Implemented. The three-role model is enforced server-side: schema, model, middleware, role-assignment endpoint, and audit. The **Phase 26b** UI (admin sidebar variant + User Management role selector + Playwright e2e + final docs) is pending.

Introduce a new role distinct from User and Administrator, expanding the role model to **three** roles in total:

- **Three roles:** **User** (default), **Office Administrator** (new), **Administrator** (existing top-level admin).
- **Office Administrator capabilities:**
  - Manage **key fob allocation** (see section 22): set fob counts (overall default and per-day overrides), view fob requirement reports, view past fob allocation reports.
  - **Modify other people's desk bookings**: create, cancel, or change a desk booking on behalf of another user, subject to the same business rules that already apply to admin desk operations (no double-booking, valid date ranges, etc.).
- **Office Administrator restrictions:**
  - **Cannot add or remove users.** User provisioning and deletion remain exclusive to the **Administrator** role.
  - **Cannot edit other configuration** outside of fob settings (desk count, parking count, version configuration, audit retention, role assignment, etc. remain Administrator-only).
- **Role assignment and removal:**
  - **Only an Administrator** may grant or revoke the Office Administrator role on another user. Office Administrators cannot promote or demote anyone.
  - An **Office Administrator may be removed** (deleted) by an **Administrator**, subject to existing user-deletion rules in section 10.
- **Self-protection rules:**
  - The minimum-one-admin invariant from section 10 applies to **Administrators only**; Office Administrators do **not** count toward the minimum admin requirement and are **not** subject to a minimum count of their own.
  - Existing self-deletion forbidden rules from section 10 apply to Administrators; Office Administrators may also not delete their own account (since deletion is Administrator-only, an Office Administrator could not delete anyone in any case).
- **UI / navigation:** Office Administrators see a slimmed admin sidebar containing only fob management, fob reports, and other-user desk booking management. They do **not** see User Management, Resource Configuration (desk/parking counts), Audit (admin-only), or any other Administrator-only sections.
- **API authorization:** The new role is enforced server-side on every endpoint. Endpoints that previously required `admin` are reviewed and split into "Administrator only" vs "Administrator or Office Administrator" as defined by the capabilities above. Audit events (per section 15) capture the **actor role** for any action so that office-admin actions are distinguishable from administrator actions in the trail.
- **Backwards compatibility:** Existing users default to **User**. Existing Administrators are unchanged. No automatic promotion to Office Administrator occurs on migration.

This feature lets a delegated person manage day-to-day fob logistics and other-user desk changes without granting full administrator access.

### 22. Key Fob Request and Allocation Subsystem

Allow a desk booking to optionally request a building **key fob**, and let Office Administrators (and Administrators) manage fob inventory and reporting.

- **Per-booking fob request flag (22.1):** When a user creates a desk booking, the booking form includes a **"Fob needed"** checkbox. The flag is stored against the booking and applies to **every day** of a multi-day booking. The flag is also exposed in **My Bookings** so the user can see which of their bookings included a fob request.
- **Per-day fob requirement report (22.2):** Office Administrators (and Administrators) can view a **calendar** report. Each calendar day shows the **count of fobs required** for that day, computed from active desk bookings flagged "fob needed" that overlap that day. The calendar supports month navigation and an optional date-range filter.
- **Configurable fob inventory (22.3):**
  - Office Administrators may specify a **default total number of fobs** available, applied to every day unless overridden.
  - Office Administrators may also specify a **per-day fob count** for specific dates that overrides the default for that date only.
  - Both settings are **optional**. If no inventory is configured, fob requests are **tracked** (flag stored on the booking) but **never** block booking.
- **Booking enforcement when inventory is set (22.3):**
  - When an inventory limit exists and the user ticks **"Fob needed"**, the booking is **blocked** if granting the fob would exceed the available inventory on **any** day in the requested range.
  - Available on a given day = `inventory_for_day - (count of active bookings with fob_requested = true overlapping that day)`.
  - The user sees a clear error message identifying the offending date(s), e.g. **"Fob unavailable: only N fob(s) remaining on YYYY-MM-DD"**.
  - The user may either uncheck "Fob needed" and proceed (booking succeeds without a fob), or pick different dates.
- **Past allocation report (22.4):** Office Administrators can view a **historical allocation report** that lists, for each past day, every booking that was granted a fob, including the **person** who took the fob (name and email), the **date(s)**, and the **booking id**. The report supports a date-range filter and is **exportable to CSV** consistent with existing admin reports.
- **Visibility:**
  - End users see the **Fob needed** checkbox on the desk booking form. When inventory is configured, an inline hint shows remaining fob availability for the selected date(s).
  - The fob calendar and history reports are visible only to **Office Administrators** and **Administrators**.
- **Audit (per section 15):** Fob inventory changes and fob-request outcomes emit audit events such as `FOB_INVENTORY_DEFAULT_UPDATED`, `FOB_INVENTORY_OVERRIDE_SET`, `FOB_INVENTORY_OVERRIDE_REMOVED`, `FOB_REQUEST_GRANTED` (on successful booking with `fob_requested = true`), and `FOB_REQUEST_DENIED` (on a booking blocked by inventory).
- **Cancellation:** Cancelling a desk booking that included a fob releases that fob for the day(s) of the booking; the released capacity is immediately available for the next request.
- **Cascade:** Deleting a user removes their bookings (per existing rules) which also releases any fobs associated with those bookings.

## API Endpoints

### Authentication

All API endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer user_123
```

For admin endpoints, use:
```
Authorization: Bearer admin_1
```

### Desk Management

- `GET /api/desks` - Get all active desks
- `GET /api/desks/:id` - Get desk by ID
- `POST /api/desks` - Create a new desk (admin only)
- `PUT /api/desks/:id` - Update a desk (admin only)
- `DELETE /api/desks/:id` - Delete a desk (admin only)

### Desk Bookings

- `GET /api/bookings/my-bookings` - Get current user's bookings
- `GET /api/bookings/available` - Get available desks for date range (query params: startDate, endDate)
- `GET /api/bookings/:id` - Get booking by ID
- `POST /api/bookings` - Create a new booking (body: deskId, startDate, endDate)
- `POST /api/bookings/bulk` - Create multiple bookings in one call (body: deskIds, startDate, endDate)
- `DELETE /api/bookings/:id` - Cancel a booking (the response carries an `X-Undo-Window-Ms` header giving the number of milliseconds the user has to undo the cancellation)
- `POST /api/bookings/:id/undo-cancel` - Phase 23c: restore a self-cancelled booking within the undo window if the desk is still available. Errors: `400 UNDO_EXPIRED`, `409 DESK_UNAVAILABLE`, `403 FORBIDDEN` (not owner or admin-initiated cancel), `400 NOT_CANCELLED`.

### Parking Spaces

- `GET /api/parking-spaces` - Get all active parking spaces
- `GET /api/parking-spaces/available` - Get available parking spaces (query params: reservationDate, timePeriod)
- `GET /api/parking-spaces/:id` - Get parking space by ID
- `POST /api/parking-spaces` - Create a new parking space (admin only)
- `PUT /api/parking-spaces/:id` - Update a parking space (admin only)
- `DELETE /api/parking-spaces/:id` - Delete a parking space (admin only)

### Parking Reservations

- `GET /api/parking-reservations/my-reservations` - Get current user's parking reservations
- `GET /api/parking-reservations/available` - Check parking space availability (query params: parkingSpaceId, reservationDate, timePeriod)
- `GET /api/parking-reservations/:id` - Get reservation by ID
- `POST /api/parking-reservations` - Create a new reservation (body: parkingSpaceId, reservationDate, timePeriod)
- `DELETE /api/parking-reservations/:id` - Cancel a reservation

### Floor Plan Maps (Phase 23d)

Public-but-authenticated read endpoints (any signed-in user with a complete profile):

- `GET /api/maps/:context` - Get the map configuration for a context (`desk` or `parking`). Response: `{ context, floorPlan: { url, mime, version, uploadedAt } | null, landmarks: [...], resources: [...] }`.
- `GET /api/maps/:context/floor-plan/image?v=N` - Stream the floor plan image bytes. The `v` query parameter cache-busts on every replace.

Admin-only mutating endpoints:

- `GET /api/admin/maps/:context` - Same shape as the public GET; for the editor UI.
- `POST /api/admin/maps/:context/floor-plan` - Replace the floor plan image. Body is the **raw image bytes**; `Content-Type` must be `image/png` or `image/jpeg`. Hard cap **2 MB**. Magic bytes are sniffed against the declared mime so a spoofed `Content-Type` is rejected (`400 INVALID_IMAGE`). Bumps `image_version`.
- `DELETE /api/admin/maps/:context/floor-plan` - Remove the floor plan and its image file.
- `POST /api/admin/maps/:context/landmarks` - Body `{ type, label?, x, y }`. Coordinates are in `[0, 1]`. `type` must be one of the catalogue values; `custom` requires a non-empty `label`.
- `PUT /api/admin/maps/:context/landmarks/:id` - Patch any subset of `{ type, label, x, y }`.
- `DELETE /api/admin/maps/:context/landmarks/:id`
- `PUT /api/admin/maps/:context/resources/:resourceId/coordinates` - Body `{ x, y }`. Validates the resource (desk or parking space) exists.
- `DELETE /api/admin/maps/:context/resources/:resourceId/coordinates`

### Admin Endpoints

- `GET /api/admin/configuration` - Get current configuration (admin only)
- `PUT /api/admin/configuration/desk-count` - Update desk count (admin only, body: deskCount)
- `PUT /api/admin/configuration/parking-count` - Update parking count (admin only, body: parkingCount)
- `GET /api/admin/bookings` - Get all bookings (admin only)
- `GET /api/admin/parking-reservations` - Get all parking reservations (admin only)
- `DELETE /api/admin/bookings/:id` - Cancel any booking (admin only, body: reason)
- `DELETE /api/admin/parking-reservations/:id` - Cancel any reservation (admin only, body: reason)
- `GET /api/admin/audit-events` - List and search the audit trail (admin only, query: `limit` default 50 / max 500, `offset` default 0, `search` substring match over action_type / actor_email / summary / payload). Response shape: `{ events: [...], limit, offset }` with events in newest-first order.
- `PUT /api/auth/users/:id/role` - Phase 26: change a user's role (Administrator only). Body `{ role: 'user' | 'office_admin' | 'admin' }`. Errors: `400 INVALID_ROLE`, `400 CANNOT_DEMOTE_LAST_ADMIN`, `403 FORBIDDEN`, `404 USER_NOT_FOUND`. Emits `USER_ROLE_CHANGED` audit event.

### Error Responses

All endpoints return errors in the following format:
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

Common error codes:
- `AUTH_REQUIRED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `MISSING_PARAMETERS` - Required parameters missing
- `INVALID_DATE` - Invalid date format
- `DESK_UNAVAILABLE` - Desk not available for selected dates
- `PARKING_SPACE_UNAVAILABLE` - Parking space not available
- `BOOKING_NOT_FOUND` - Booking not found
- `INVALID_DESK_COUNT` - Invalid desk count configuration

## Testing Instructions

The project uses Node.js testing frameworks (e.g., Jest, Mocha, or similar) for testing. All tests run in Docker containers with a dedicated test database environment.

The project follows test-driven development practices:
- Unit tests for business logic (services)
- Integration tests for database operations using raw SQL
- API endpoint tests for HTTP handlers
- Frontend tests for JavaScript functionality
- Use case validation tests based on documented use cases in `docs/usecases.md`
- Tests must pass before committing changes

### Test Environment

The test environment runs in Docker with:
- Separate MySQL container for test database
- Isolated test data that is reset between test runs
- Test scripts located in the `utils/` directory

### Running Tests

- Run all tests in Docker: Use test scripts from `utils/` directory or `docker-compose -f docker-compose.test.yml up --abort-on-container-exit`
- Test scripts are located in `utils/` directory for easy execution
- Tests automatically set up and tear down test database as needed

### Use Case Testing

All features should be validated against the use cases documented in `docs/usecases.md`. Each use case includes:
- Step-by-step implementation requirements
- Expected results
- Manual testing paths for validation

Use cases cover scenarios including:
- Multi-day desk bookings
- Combined desk and parking bookings
- Error handling for unavailable resources
- Admin configuration and management
- User self-service cancellation
- End-to-end workflows combining multiple features

## Deployment Instructions

[To be documented once deployment strategy is determined]

## Recent Updates

- **Phase 1 Completed**: Project setup and infrastructure fully implemented
  - Docker configuration for development and testing environments
  - Node.js Express server with MySQL connection pooling
  - Base repository pattern with raw SQL queries
  - Testing framework (Jest) with test database utilities
  - Frontend structure with HTML/CSS/JavaScript foundation
  - Authentication, error handling, and logging infrastructure
- Initial project documentation created
- Defined the core features: desk booking and parking tracking (overtime tracking was built historically in Phase 4 and removed end-to-end in Phase 23a)
- Technology stack selected: Node.js backend, MySQL database, raw SQL data access layer, HTML/CSS/JS frontend
- Docker support added: All services run in Docker containers, including dedicated test environment
- Use cases documented: Seven detailed use cases covering all major user workflows (see `docs/usecases.md`)
- Feature requests added: Enhanced admin resource configuration with flexible numbering options, improved desk number display in booking interface, admin screen display of allocated desk numbers, comprehensive user authentication and management system, enhanced user management with profiles and password reset, first user admin registration system, admin user deletion with minimum admin constraint, booking matrix screen for visualizing bookings by people and dates, booking validation rules to prevent conflicts, availability display enhancement showing remaining spaces, multi-select desk and parking booking functionality, remove booking confirmation modal for streamlined UX, comprehensive test coverage requirements, and version tracking with semantic versioning
- **Specification update:** Overtime removal delivered in Phase 23a (see section 16 above). Floor plan maps for desk and parking with admin-uploaded PNG/JPG and admin-only landmarks, undo after user desk cancel, and consistent booking button sizes are still planned (see sections 17--19)
