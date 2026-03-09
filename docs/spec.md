# Office Manager

## Project Overview

Office Manager is a web application designed to manage office operations and resources. The application provides tools for tracking and managing various aspects of office life, including desk bookings, parking spaces, and overtime hours.

## Purpose

The primary purpose of Office Manager is to provide a centralized system for managing day-to-day office operations. The application helps organizations:

- Track and manage desk bookings to optimize office space utilization
- Monitor parking space availability and assignments
- Record and manage employee overtime hours

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

### Phase 4: Overtime Tracking Feature (Completed)

Complete overtime tracking system with automatic hour calculation:

- **Database Schema**: `overtime_records` table with approval workflow support
- **Models & Repositories**: OvertimeRecord model with automatic total hours calculation
- **Business Logic**: OvertimeService with validation and approval workflow
- **API Endpoints**: RESTful endpoints for overtime record management, history, and reports
- **Frontend UI**: Complete overtime entry form with real-time hour calculation and history display
- **Testing**: Unit tests, integration tests, and use case validation tests

**Related Use Cases:** Use Case 7 (Employee Books Desk, Parking Space, and Records Overtime)

### Phase 5: Admin Functionality (Completed)

Complete administrative features for resource and booking management:

- **Database Schema**: `admin_config` table for configuration management
- **Models & Repositories**: AdminConfiguration model and repository
- **Business Logic**: AdminService with validation to prevent reducing counts below active bookings
- **API Endpoints**: RESTful endpoints for configuration management and admin booking operations
- **Frontend UI**: Admin dashboard with tabs for configuration, bookings, parking, and overtime management
- **Authentication**: Role-based access control with admin authorization checks
- **Testing**: Unit tests, integration tests, and use case validation tests

**Related Use Cases:** Use Case 4 (Admin Sets Up Number of Desks and Parking Spaces), Use Case 5 (Admin Cancels User Desk Booking)

**Note:** Enhanced features for flexible desk/parking number assignment are planned (see "Not Yet Implemented" section).

### Phase 6: Integration and Polish (Completed)

Integration and polish features:

- **User Dashboard**: Home page dashboard showing summary statistics (active bookings, reservations, overtime hours)
- **Search & Filtering**: Search and filter functionality across all bookings, reservations, and overtime records
- **Notification System**: Client-side notification system for success, error, info, and warning messages
- **Unified My Bookings View**: Integrated view showing all desk bookings, parking reservations, and overtime records
- **Navigation**: Consistent navigation across all pages
- **Documentation**: API documentation and user guides

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
- **User Creation**: Admin users can create new users with email address (used as username/login), password, first name, last name, and office location
- **Password Management**: Users can change their passwords
- **Admin Configuration**: Initial admin user configured via `config.json` in the `data/` folder with configurable email address (used as username) and optional password
- **User Restrictions**: Users can only book desks/spaces for themselves and update their own data
- **Development Test User**: Test user (Email: test@example.com or similar, Password: Password123) created automatically in development mode only (to be removed - see First User Admin Registration feature)
- **User Indicator**: Icon at top left of screen displays logged-in user information
- **Access Control**: 
  - Logged-in users: Full access to all features except user creation (admin only)
  - Not logged-in users: Can only view available desks/spaces, cannot access overtime screen or make bookings
- **Login Redirect**: Unauthenticated users attempting to book desks/spaces are redirected to login screen

This feature will provide secure user authentication and proper access control throughout the application.

### 4a. Enhanced User Management

Enhanced user management system with comprehensive user profiles and password recovery:

- **User Profile Fields**: Users must provide first name, last name, email address (used as username/login identifier), and office location when created. No separate username field is required - email address serves as the login identifier.
- **Office Location**: Hardcoded list of office locations (currently London or Prague)
- **Admin Flag**: Users have an `IsAdmin` boolean flag to designate administrative privileges
- **Admin User Creation**: Admin users can create new users through the admin interface
- **Login Screen**: Dedicated login screen for user authentication using email address as the username/login identifier
- **Password Reset**: Forgotten password functionality that emails a reset link to the user's email address
- **Admin Setup Script**: Utility script to add initial admin user (paul.michaels@travelhx.com) with admin privileges

This feature will provide a complete user management system with proper user profiles, role management, and password recovery capabilities.

### 4b. First User Admin Registration

Initial user registration system where the first user to register automatically becomes an admin:

- **First User Admin**: The first user to register in the system automatically receives admin privileges (IsAdmin flag set to true)
- **No Users Detection**: When navigating to the site with no registered users, display a registration screen informing users that they can register to become the first admin
- **Application Startup Cleanup**: When the application starts, it automatically runs cleanup logic that:
  - Removes the admin/password123 test user if it exists
  - If the "admin" user exists, flushes all users from the system (clean slate for production)
- **Registration Flow**: When no users exist, users are presented with a registration screen instead of login screen
- **Automatic Admin Assignment**: The first registered user is automatically assigned admin privileges without manual intervention

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

This feature will improve efficiency for users who need to book multiple resources at once, while maintaining the existing single-booking functionality.

### 9. Remove Booking Confirmation Modal

Simplified booking flow by removing the unnecessary modal dialog:

- **Direct Booking**: When users click "Book" on a desk or parking space, the booking is created immediately without showing a confirmation modal
- **Streamlined UX**: Removes an extra step in the booking process, making it faster and more efficient
- **Success Feedback**: Booking success is indicated through other means (e.g., success message, visual update, or redirect) without requiring modal confirmation
- **Error Handling**: Errors are still displayed appropriately without using a modal dialog

This feature will streamline the booking process by removing an unnecessary confirmation step, making bookings faster and more intuitive.

### 10. Admin User Deletion

Administrative functionality to delete users with safety constraints:

- **Admin User Deletion**: Admin users can delete other users from the system
- **Minimum Admin Constraint**: The system must always maintain at least one admin user
  - If attempting to delete the last admin user, the operation is prevented with an appropriate error message
  - Validation checks the number of admin users before allowing deletion
- **User Deletion**: Admin users can delete regular (non-admin) users without restrictions
- **Admin Deletion**: Admin users can delete other admin users, but only if at least one admin will remain
- **Error Handling**: Clear error messages when deletion is prevented due to minimum admin constraint
- **Cascade Handling**: Determine how to handle bookings, reservations, and overtime records associated with deleted users (e.g., mark as cancelled, reassign, or prevent deletion if active bookings exist)

This feature will provide administrators with user management capabilities while ensuring system integrity through the minimum admin constraint.

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

Automatic version tracking system that increments on each deployment/commit:

- **Semantic Versioning**: Version numbers follow semantic versioning format (MAJOR.MINOR.PATCH, e.g., 1.2.3)
- **Automatic Increment**: Each commit/deployment automatically increments the version number
- **Database Storage**: Version number is stored in a database table
- **Startup Version Update**: The first thing the application does on startup is attempt to update the version number in the database
- **Error Handling**: If the version number cannot be updated in the database, an error is displayed on the screen
- **Client Configuration**: Version number is also stored in a client-side configuration table/file
- **Version Display**: Version number should be accessible and displayable in the application

This feature will provide version tracking for deployments and help identify which version of the application is running.

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

### Overtime Records

- `GET /api/overtime/my-overtime` - Get current user's overtime records
- `GET /api/overtime/reports` - Generate overtime report (query params: startDate, endDate)
- `GET /api/overtime/:id` - Get overtime record by ID
- `POST /api/overtime` - Create a new overtime record (body: recordDate, startTime, endTime, description)
- `PUT /api/overtime/:id` - Update an overtime record
- `DELETE /api/overtime/:id` - Delete an overtime record

### Admin Endpoints

- `GET /api/admin/configuration` - Get current configuration (admin only)
- `PUT /api/admin/configuration/desk-count` - Update desk count (admin only, body: deskCount)
- `PUT /api/admin/configuration/parking-count` - Update parking count (admin only, body: parkingCount)
- `GET /api/admin/bookings` - Get all bookings (admin only)
- `GET /api/admin/parking-reservations` - Get all parking reservations (admin only)
- `GET /api/admin/overtime-records` - Get all overtime records (admin only)
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
- Defined three core features: desk booking, parking tracking, and overtime tracking
- Technology stack selected: Node.js backend, MySQL database, raw SQL data access layer, HTML/CSS/JS frontend
- Docker support added: All services run in Docker containers, including dedicated test environment
- Use cases documented: Seven detailed use cases covering all major user workflows (see `docs/usecases.md`)
- Feature requests added: Enhanced admin resource configuration with flexible numbering options, improved desk number display in booking interface, admin screen display of allocated desk numbers, comprehensive user authentication and management system, enhanced user management with profiles and password reset, first user admin registration system, admin user deletion with minimum admin constraint, booking matrix screen for visualizing bookings by people and dates, booking validation rules to prevent conflicts, availability display enhancement showing remaining spaces, multi-select desk and parking booking functionality, remove booking confirmation modal for streamlined UX, comprehensive test coverage requirements, and version tracking with semantic versioning
