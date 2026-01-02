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

- **User Creation**: Admin users can create new users with alphanumeric user IDs and passwords
- **Password Management**: Users can change their passwords
- **Admin Configuration**: Initial admin user configured via `config.json` in the `data/` folder with configurable user ID and optional password
- **User Restrictions**: Users can only book desks/spaces for themselves and update their own data
- **Development Test User**: Test user (ID: 0001, Password: Password123) created automatically in development mode only
- **User Indicator**: Icon at top left of screen displays logged-in user information
- **Access Control**: 
  - Logged-in users: Full access to all features except user creation (admin only)
  - Not logged-in users: Can only view available desks/spaces, cannot access overtime screen or make bookings
- **Login Redirect**: Unauthenticated users attempting to book desks/spaces are redirected to login screen

This feature will provide secure user authentication and proper access control throughout the application.

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
- Feature requests added: Enhanced admin resource configuration with flexible numbering options, improved desk number display in booking interface, admin screen display of allocated desk numbers, comprehensive user authentication and management system, booking matrix screen for visualizing bookings by people and dates, and booking validation rules to prevent conflicts
