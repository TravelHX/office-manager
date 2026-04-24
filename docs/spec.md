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

A durable **audit log** of significant user and system-facing actions for compliance, support, and security review.

- **Admin-only access**: A dedicated **Audit** area is available **only to administrators**. Non-admin users must not see audit UI or call audit APIs (enforce on server; UI hidden or absent for non-admins).

- **Scope of tracking**: **Every meaningful user-driven action** in the application should produce an audit record. This includes at minimum (extend as features grow):
  - **Authentication**: successful login, logout; optional failed login attempts if technically and policy-wise appropriate
  - **Desk bookings**: create booking, cancel own booking; **admin** cancel desk booking (with reason if captured)
  - **Parking**: create reservation, cancel own reservation; **admin** cancel reservation
  - **Admin configuration**: save desk/parking counts and related resource settings; desk/parking numbering changes
  - **User management**: create user, delete user, password changes initiated by admin or self-service where applicable; profile completion after provisioning
  - **Bulk or matrix-related actions** that change data (e.g. bulk desk booking) as separate event types where distinct from single-item actions

- **Actors**: The audit trail records **who** performed each action. **All users including administrators** are subject to logging; admin actions use the same schema and are visible in the same trail.

- **Event model** (conceptual): Each entry should include at least: **timestamp** (UTC or documented timezone), **actor user id** (and display identifier such as email where stored for readability), **action type** (stable machine-readable code, e.g. `DESK_BOOKING_CREATED`), **summary or payload** (JSON or text sufficient to reconstruct context without storing secrets: no passwords, no full tokens), optional **target entity type and id** (e.g. booking id, desk id), and **IP address or client hint** if available and allowed by policy.

- **Search (admin UI)**: Admins can **search** the audit trail via a **simple search box** (single field). Search should match common fields such as action type, actor email/name, free-text summary, and relevant ids exposed in the stored payload, with behavior documented after implementation (e.g. case-insensitive substring, date filters as a follow-up if not in initial scope).

- **Performance and retention**: Implementation should use an **indexed** store (database table with appropriate indexes for time and actor). **Retention policy** (how long events are kept) may be configurable or documented as a later task if not in the first delivery.

- **Planned API** (admin only, to be added under Admin endpoints when implemented): e.g. `GET /api/admin/audit-events` with query parameters for **search** text, **pagination** (limit/offset or cursor), and optional filters (date range, actor, action type) if added beyond the minimum search box.

- **Integrity**: Records should be **append-only** from the application (no user-facing edit or delete of audit rows in normal operation). Any administrative purge should itself be auditable or strictly controlled.

This feature supports accountability across **all** roles and makes support and investigations practical without exposing the log to non-admins.

### 16. Removal of Overtime Feature (Delivered in Phase 23a)

The overtime capability was **removed end-to-end from the product** in Phase 23a:

- **No overtime UI**: The Overtime page, the overtime dashboard card, overtime rows in My Bookings, the admin overtime tab, and overtime links in navigation and shell are all deleted.
- **No overtime APIs**: `/api/overtime/*` routes and the admin `/api/admin/overtime-records` endpoint are removed; requests return 404.
- **Data**: The `overtime_records` table is dropped by an idempotent step in `src/backend/database/migrations.js`. Operators who need a historical copy must back up the table before upgrading past Phase 23a (see `docs/technical-notes-phase23-overtime-removal.md`).
- **Cross-features**: Booking matrix, dashboard summaries, the profile-complete restrictions, and every test that previously referenced overtime have been updated.
- **Documentation**: `README.md`, `docs/usecases.md`, `docs/audit-events.md`, and this specification have been aligned with the removal.

### 17. Floor Plan Map for Desk and Parking Selection

Visual **map** (floor plan) support for choosing desks and parking spaces:

- **Two contexts**: A **desk** map on the desk booking flow and a **carpark** map on the parking reservation flow. Each context has its own **floor plan image** and map metadata (they may show the same physical image only if the product is configured that way).
- **Square map area (2a)**: The map is displayed in a **square** viewport (equal width and height, e.g. `aspect-ratio: 1 / 1` with responsive width). The floor plan image **fits inside** the square (e.g. `object-fit: contain`) so the diagram is not distorted.
- **Floor plan image (2d)**: Admins can **upload** a replacement floor plan as **PNG or JPG** only (validate MIME/extension and a reasonable maximum file size). Stored server-side in a documented location (e.g. under `data/` or configured storage); prior image replaced or versioned per implementation notes.
- **Landmarks (2b, 2c)**: Admins can place **landmark markers** on the map (types such as **toilet**, **lift**, **stairs**, **exit**, **kitchen**, plus optional **custom label**). Landmarks are **for orientation only**: they **must not** intercept or block clicks on **desk** or **parking** markers (e.g. lower z-index, pointer-events, or hit-test rules). End users **see** landmarks but **cannot** edit them. **Only administrators** can add, move, edit, or delete landmarks and upload or replace the floor plan (2c).
- **Resource markers**: Desks and parking spaces appear on the map at **admin-defined positions** (normalized coordinates, e.g. fractions of image width/height) so they stay aligned when the square viewport scales. Selecting or booking from the map must stay consistent with list-based flows and existing validation rules.
- **Accessibility**: Map interactions should have a non-map fallback (existing list) where practical; keyboard focus order documented where implemented.

### 18. Undo Desk Booking Cancellation

When a user **cancels** their own desk booking:

- The UI shows an **immediate Undo** affordance (e.g. banner or toast with an **Undo** action).
- **Undo** restores the booking **only if** still allowed: within a **short time window** (specific duration is an implementation choice, e.g. 15--30 seconds, documented in README) and the desk remains **available** for those dates (no conflicting booking created in the meantime).
- If Undo expires or is not possible, the user sees a clear message and the booking remains cancelled.
- Admin cancellation of another user's booking **does not** require this Undo pattern unless product later extends it (initial scope: **user self-cancel** only).

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
- `DELETE /api/bookings/:id` - Cancel a booking

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

### Admin Endpoints

- `GET /api/admin/configuration` - Get current configuration (admin only)
- `PUT /api/admin/configuration/desk-count` - Update desk count (admin only, body: deskCount)
- `PUT /api/admin/configuration/parking-count` - Update parking count (admin only, body: parkingCount)
- `GET /api/admin/bookings` - Get all bookings (admin only)
- `GET /api/admin/parking-reservations` - Get all parking reservations (admin only)
- `DELETE /api/admin/bookings/:id` - Cancel any booking (admin only, body: reason)
- `DELETE /api/admin/parking-reservations/:id` - Cancel any reservation (admin only, body: reason)

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
