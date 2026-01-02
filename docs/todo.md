# TODO List

This document contains all tasks organized by phases with clear dependencies and priorities.

## Phase 1: Project Setup and Infrastructure

**Objective:** Establish the project foundation, including Docker setup, Node.js project setup, MySQL database configuration, raw SQL data access layer, test environment configuration, and basic infrastructure components.

**Dependencies:** None

**Priority:** High

**Estimated Effort:** 3-4 days

### Tasks

- [x] 1.1 Create Dockerfile for Node.js backend application
- [x] 1.2 Create docker-compose.yml for development environment (backend and MySQL)
- [x] 1.3 Create docker-compose.test.yml for test environment with test database
- [x] 1.4 Create utils/ directory for utility scripts
- [x] 1.5 Create test environment setup scripts in utils/ directory
- [x] 1.6 Create test database initialization scripts in utils/ directory
- [x] 1.7 Configure Docker networking and environment variables
- [x] 1.8 Initialize Node.js project with package.json and install dependencies
- [x] 1.9 Set up project structure (src/, tests/, frontend/, utils/ folders)
- [x] 1.10 Install and configure MySQL connection pool library (mysql2)
- [x] 1.11 Create database connection module with connection pooling
- [x] 1.12 Create SQL scripts for database initialization and migrations
- [x] 1.13 Set up MySQL database schema initialization in Docker
- [x] 1.14 Implement base data access layer with raw SQL query execution
- [x] 1.15 Create base repository pattern using raw SQL queries
- [x] 1.16 Set up Node.js HTTP server (Express or native HTTP module)
- [x] 1.17 Implement basic routing structure for API endpoints
- [x] 1.18 Implement basic authentication and authorization middleware
- [x] 1.19 Set up logging and error handling infrastructure
- [x] 1.20 Create configuration management for environment variables (Docker-aware)
- [x] 1.21 Set up testing framework (Jest/Mocha) and test infrastructure
- [x] 1.22 Create test database setup and teardown utilities in utils/ directory
- [x] 1.23 Create test scripts in utils/ directory for running tests in Docker
- [x] 1.24 Set up frontend folder structure (HTML, CSS, JS)
- [x] 1.25 Create base HTML template and CSS framework
- [x] 1.26 Write tests for database connection and data access layer (run in Docker test environment)

---

## Phase 2: Desk Booking Feature

**Objective:** Implement the desk booking tracking functionality, allowing users to view, book, and manage desk reservations. This phase implements Use Cases 1, 3, and 6 from `docs/usecases.md`.

**Dependencies:** Phase 1 (Project Setup and Infrastructure)

**Priority:** High

**Estimated Effort:** 3-4 days

### Tasks

- [x] 2.1 Design and create database schema for desks and bookings
- [x] 2.2 Create Desk model and related DTOs
- [x] 2.3 Create Booking model and related DTOs
- [x] 2.4 Implement Desk repository with CRUD operations using raw SQL queries
- [x] 2.5 Implement Booking repository with CRUD operations using raw SQL queries
- [x] 2.6 Create DeskService with business logic for desk management
- [x] 2.7 Create BookingService with business logic for booking management
- [x] 2.8 Implement validation for booking conflicts and availability
- [x] 2.9 Implement multi-day booking support (date range selection)
- [x] 2.10 Create Node.js API endpoints for desk management (list, create, update, delete)
- [x] 2.11 Create Node.js API endpoints for booking management (create, view, cancel)
- [x] 2.12 Create Node.js API endpoint to check desk availability for date ranges
- [x] 2.13 Implement error handling for unavailable desks with appropriate messages
- [x] 2.14 Write unit tests for DeskService
- [x] 2.15 Write unit tests for BookingService
- [x] 2.16 Write integration tests for desk booking API endpoints
- [x] 2.17 Create HTML/CSS/JS UI components for desk listing and selection
- [x] 2.18 Create HTML/CSS/JS UI components for booking creation and management (including date range picker)
- [x] 2.19 Create HTML/CSS/JS UI component for "My Bookings" view
- [x] 2.20 Implement booking cancellation UI and functionality
- [x] 2.21 Write JavaScript tests for desk booking functionality
- [x] 2.22 Validate implementation against Use Case 1 (Employee Books Desk for Two Days)
- [x] 2.23 Validate implementation against Use Case 3 (Employee Attempts to Book Unavailable Desk)
- [x] 2.24 Validate implementation against Use Case 6 (User Cancels Their Own Desk Booking)

---

## Phase 3: Parking Tracking Feature

**Objective:** Implement the parking space tracking functionality, allowing users to view, reserve, and manage parking space assignments. This phase implements Use Case 2 from `docs/usecases.md`.

**Dependencies:** Phase 1 (Project Setup and Infrastructure)

**Priority:** High

**Estimated Effort:** 3-4 days

### Tasks

- [x] 3.1 Design and create database schema for parking spaces and reservations
- [x] 3.2 Create ParkingSpace model and related DTOs
- [x] 3.3 Create ParkingReservation model and related DTOs
- [x] 3.4 Implement ParkingSpace repository with CRUD operations using raw SQL queries
- [x] 3.5 Implement ParkingReservation repository with CRUD operations using raw SQL queries
- [x] 3.6 Create ParkingSpaceService with business logic for parking space management
- [x] 3.7 Create ParkingReservationService with business logic for reservation management
- [x] 3.8 Implement validation for reservation conflicts and availability
- [x] 3.9 Implement half-day reservation support (morning/afternoon time periods)
- [x] 3.10 Create Node.js API endpoints for parking space management (list, create, update, delete)
- [x] 3.11 Create Node.js API endpoints for reservation management (create, view, cancel)
- [x] 3.12 Create Node.js API endpoint to check parking space availability for date ranges and time periods
- [x] 3.13 Write unit tests for ParkingSpaceService
- [x] 3.14 Write unit tests for ParkingReservationService
- [x] 3.15 Write integration tests for parking tracking API endpoints
- [x] 3.16 Create HTML/CSS/JS UI components for parking space listing and selection
- [x] 3.17 Create HTML/CSS/JS UI components for reservation creation and management (including time period selection)
- [x] 3.18 Integrate parking reservations into "My Bookings" view
- [x] 3.19 Implement parking reservation cancellation UI and functionality
- [x] 3.20 Write JavaScript tests for parking tracking functionality
- [x] 3.21 Validate implementation against Use Case 2 (Employee Books Desk and Parking Space for Half Day)

---

## Phase 4: Overtime Tracking Feature

**Objective:** Implement the overtime hours tracking functionality, allowing users to record, view, and manage overtime hours. This phase implements part of Use Case 7 from `docs/usecases.md`.

**Dependencies:** Phase 1 (Project Setup and Infrastructure)

**Priority:** High

**Estimated Effort:** 3-4 days

### Tasks

- [x] 4.1 Design and create database schema for overtime records
- [x] 4.2 Create OvertimeRecord model and related DTOs
- [x] 4.3 Implement OvertimeRecord repository with CRUD operations using raw SQL queries
- [x] 4.4 Create OvertimeService with business logic for overtime management
- [x] 4.5 Implement validation for overtime records (date ranges, hours, time calculations)
- [x] 4.6 Implement automatic calculation of total hours from start/end times
- [x] 4.7 Create Node.js API endpoints for overtime record management (create, view, update, delete)
- [x] 4.8 Create Node.js API endpoint to retrieve overtime history for users
- [x] 4.9 Create Node.js API endpoint to generate overtime reports
- [x] 4.10 Implement overtime approval workflow (if required)
- [x] 4.11 Write unit tests for OvertimeService
- [x] 4.12 Write integration tests for overtime tracking API endpoints
- [x] 4.13 Create HTML/CSS/JS UI components for overtime entry form (date, start time, end time, description)
- [x] 4.14 Create HTML/CSS/JS UI components for overtime history display
- [x] 4.15 Create HTML/CSS/JS UI components for overtime reports
- [x] 4.16 Integrate overtime records into dashboard and "My Bookings" view
- [x] 4.17 Write JavaScript tests for overtime tracking functionality
- [x] 4.18 Validate implementation against Use Case 7 (Employee Books Desk, Parking Space, and Records Overtime)

---

## Phase 5: Admin Functionality

**Objective:** Implement administrative features for managing office resources and user bookings. This phase implements Use Cases 4 and 5 from `docs/usecases.md`.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking)

**Priority:** High

**Estimated Effort:** 2-3 days

### Tasks

- [x] 5.1 Design and create database schema for admin configuration (desk count, parking space count)
- [x] 5.2 Create AdminConfiguration model and related DTOs
- [x] 5.3 Implement AdminConfiguration repository with CRUD operations using raw SQL queries
- [x] 5.4 Create AdminService with business logic for resource configuration
- [x] 5.5 Implement validation for configuration changes (cannot reduce below active bookings)
- [x] 5.6 Create Node.js API endpoints for admin configuration (get, update desk/parking counts)
- [x] 5.7 Create Node.js API endpoints for viewing all bookings (admin view)
- [x] 5.8 Create Node.js API endpoint for admin to cancel any user booking
- [x] 5.9 Implement admin authentication and authorization checks
- [x] 5.10 Write unit tests for AdminService
- [x] 5.11 Write integration tests for admin API endpoints
- [x] 5.12 Create HTML/CSS/JS UI components for admin dashboard
- [x] 5.13 Create HTML/CSS/JS UI components for resource configuration (desk/parking count management)
- [x] 5.14 Create HTML/CSS/JS UI components for admin booking management view
- [x] 5.15 Implement admin booking cancellation UI with reason entry
- [x] 5.16 Write JavaScript tests for admin functionality
- [x] 5.17 Validate implementation against Use Case 4 (Admin Sets Up Number of Desks and Parking Spaces)
- [x] 5.18 Validate implementation against Use Case 5 (Admin Cancels User Desk Booking)

---

## Phase 6: Integration and Polish

**Objective:** Integrate all features, add common UI elements, implement user dashboard, and perform final testing and polish. This phase completes Use Case 7 from `docs/usecases.md`.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 4 (Overtime Tracking), Phase 5 (Admin Functionality)

**Priority:** Medium

**Estimated Effort:** 2-3 days

### Tasks

- [x] 6.1 Create HTML/CSS/JS user dashboard showing all bookings, reservations, and overtime summary
- [x] 6.2 Implement HTML/CSS/JS navigation and common UI components
- [ ] 6.3 Add user profile and settings management (deferred - basic functionality complete)
- [x] 6.4 Implement search and filtering across all features
- [x] 6.5 Add notification system for booking reminders and updates
- [x] 6.6 Integrate all features into unified "My Bookings" view
- [x] 6.7 Perform end-to-end integration testing for all use cases (use case tests implemented)
- [x] 6.8 Validate complete workflow from Use Case 7 (Employee Books Desk, Parking Space, and Records Overtime)
- [x] 6.9 Perform security testing and validation (authentication/authorization implemented and tested)
- [x] 6.10 Optimize performance and raw SQL database queries (indexes added, queries optimized)
- [x] 6.11 Update documentation with API endpoints and usage examples
- [x] 6.12 Create user documentation and help guides
- [x] 6.13 Perform final validation against all use cases in `docs/usecases.md`

---

## Phase 7: Enhanced Admin Configuration and Display Improvements

**Objective:** Enhance admin resource configuration with flexible numbering options and improve desk number display throughout the booking interface.

**Dependencies:** Phase 5 (Admin Functionality), Phase 2 (Desk Booking)

**Priority:** Medium

**Estimated Effort:** 2-3 days

### Tasks

- [x] 7.1 Design database schema changes to support flexible desk/parking number assignment
- [x] 7.2 Update Desk model to support both auto-generated and manually assigned numbers
- [x] 7.3 Update ParkingSpace model to support both auto-generated and manually assigned numbers
- [x] 7.4 Implement auto-generation logic for sequential desk numbers (e.g., 1-10 for 10 desks)
- [x] 7.5 Implement auto-generation logic for sequential parking space numbers (e.g., 1-10 for 10 spaces)
- [x] 7.6 Create AdminService methods for bulk desk creation with auto-generated numbers
- [x] 7.7 Create AdminService methods for bulk parking space creation with auto-generated numbers
- [x] 7.8 Create AdminService methods for manual desk number assignment
- [x] 7.9 Create AdminService methods for manual parking space number assignment
- [x] 7.10 Create Node.js API endpoint for bulk desk creation with auto-generation option
- [x] 7.11 Create Node.js API endpoint for bulk parking space creation with auto-generation option
- [x] 7.12 Create Node.js API endpoint for manual desk number assignment
- [x] 7.13 Create Node.js API endpoint for manual parking space number assignment
- [x] 7.14 Update admin configuration UI to include auto-generate vs manual assignment options
- [x] 7.15 Create UI component for auto-generation mode (input count, generate numbers 1-N)
- [x] 7.16 Create UI component for manual assignment mode (assign specific numbers to specific desks/spaces)
- [x] 7.17 Update desk booking display to prominently show desk numbers
- [x] 7.18 Update booking confirmation messages to include desk number
- [x] 7.19 Update "My Bookings" view to display desk numbers prominently
- [x] 7.20 Update parking reservation display to show parking space numbers prominently
- [x] 7.21 Write unit tests for auto-generation logic
- [x] 7.22 Write unit tests for manual assignment logic
- [x] 7.23 Write integration tests for enhanced admin configuration endpoints
- [x] 7.24 Write JavaScript tests for admin configuration UI
- [x] 7.25 Write JavaScript tests for enhanced desk number display
- [x] 7.26 Validate that desk numbers are displayed correctly throughout the booking flow
- [x] 7.27 Update admin dashboard to display allocated desk numbers
- [x] 7.28 Update admin booking management view to show desk numbers for each booking
- [x] 7.29 Update admin desk configuration view to list all desk numbers
- [x] 7.30 Update admin parking configuration view to list all parking space numbers
- [x] 7.31 Write JavaScript tests for admin desk number display

---

## Phase 8: User Authentication and Management

**Objective:** Implement comprehensive user authentication and management system with role-based access control, user creation, password management, and proper access restrictions.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 4 (Overtime Tracking), Phase 5 (Admin Functionality)

**Priority:** High

**Estimated Effort:** 4-5 days

### Tasks

- [x] 8.1 Design and create database schema for users table (user_id, password_hash, is_admin, created_at, updated_at)
- [x] 8.2 Create User model and related DTOs
- [x] 8.3 Implement User repository with CRUD operations using raw SQL queries
- [x] 8.4 Implement password hashing and verification utilities (bcrypt or similar)
- [x] 8.5 Create UserService with business logic for user management
- [x] 8.6 Implement user creation functionality (admin only)
- [x] 8.7 Implement password change functionality for users
- [x] 8.8 Create config.json structure in data/ folder for admin user configuration
- [x] 8.9 Implement admin user initialization from config.json (user ID configurable, password optional)
- [x] 8.10 Create development mode test user (0001 / Password123) - only in development
- [x] 8.11 Update authentication middleware to validate user existence and password
- [x] 8.12 Implement session/token management for logged-in users
- [x] 8.13 Create login API endpoint (POST /api/auth/login)
- [x] 8.14 Create logout API endpoint (POST /api/auth/logout)
- [x] 8.15 Create user creation API endpoint (POST /api/users) - admin only
- [x] 8.16 Create password change API endpoint (PUT /api/users/password)
- [x] 8.17 Create get current user API endpoint (GET /api/users/me)
- [x] 8.18 Update booking endpoints to use authenticated user ID instead of token-based user ID
- [x] 8.19 Update all API endpoints to require authentication (except public viewing endpoints)
- [x] 8.20 Implement access control: logged-in users can access all features except user creation
- [x] 8.21 Implement access control: non-logged-in users can only view available desks/spaces
- [x] 8.22 Create login page HTML/CSS/JS
- [x] 8.23 Create user creation UI component (admin only)
- [x] 8.24 Create password change UI component
- [x] 8.25 Implement user indicator icon/display in top left of screen showing logged-in user
- [x] 8.26 Implement redirect to login page when unauthenticated user tries to book desk/space
- [x] 8.27 Update frontend to check authentication status and show/hide features accordingly
- [x] 8.28 Hide overtime screen for non-logged-in users
- [x] 8.29 Update booking forms to use authenticated user context
- [x] 8.30 Write unit tests for UserService
- [x] 8.31 Write unit tests for password hashing and verification
- [x] 8.32 Write integration tests for authentication endpoints
- [x] 8.33 Write integration tests for user creation (admin only)
- [x] 8.34 Write integration tests for password change
- [x] 8.35 Write integration tests for access control (logged-in vs not logged-in)
- [x] 8.36 Write JavaScript tests for login functionality
- [x] 8.37 Write JavaScript tests for user indicator display
- [x] 8.38 Write JavaScript tests for access control and redirects
- [x] 8.39 Validate that users can only book desks/spaces for themselves
- [x] 8.40 Validate that users can only update their own data

---

## Phase 9: Booking Matrix Screen

**Objective:** Implement a visual matrix screen displaying desk and parking bookings organized by people/users and dates for easy visualization and management.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 8 (User Authentication and Management)

**Priority:** Medium

**Estimated Effort:** 3-4 days

### Tasks

- [x] 9.1 Design matrix data structure and API response format for bookings by user and date
- [x] 9.2 Create MatrixService with business logic for aggregating bookings by user and date
- [x] 9.3 Implement method to retrieve desk bookings grouped by user and date range
- [x] 9.4 Implement method to retrieve parking bookings grouped by user and date range
- [x] 9.5 Implement date range filtering for matrix data
- [x] 9.6 Implement user filtering for matrix data
- [x] 9.7 Implement desk/parking space filtering for matrix data
- [x] 9.8 Create Node.js API endpoint for matrix data (GET /api/matrix/bookings)
- [x] 9.9 Create API endpoint parameters for date range, user filter, desk filter, parking filter
- [x] 9.10 Design HTML/CSS layout for matrix grid (users/people vs dates)
- [x] 9.11 Create matrix UI component with responsive grid layout
- [x] 9.12 Implement date range selector UI component
- [x] 9.13 Implement filtering UI components (user, desk, parking space filters)
- [x] 9.14 Create visual indicators for desk bookings in matrix cells
- [x] 9.15 Create visual indicators for parking bookings in matrix cells
- [x] 9.16 Implement color coding or visual markers to distinguish desk vs parking bookings
- [x] 9.17 Add hover/tooltip functionality to show booking details in matrix cells
- [x] 9.18 Implement matrix cell click functionality to view/edit booking details
- [x] 9.19 Create separate matrix views for desks and parking (with toggle option)
- [x] 9.20 Create combined matrix view showing both desks and parking
- [x] 9.21 Add export functionality for matrix data (CSV or similar)
- [x] 9.22 Implement pagination or scrolling for large date ranges
- [x] 9.23 Add admin access control for matrix screen
- [x] 9.24 Create matrix screen navigation link in admin dashboard
- [x] 9.25 Write unit tests for MatrixService
- [x] 9.26 Write unit tests for booking aggregation logic
- [x] 9.27 Write integration tests for matrix API endpoints
- [x] 9.28 Write integration tests for filtering functionality
- [x] 9.29 Write JavaScript tests for matrix UI components
- [x] 9.30 Write JavaScript tests for date range selection
- [x] 9.31 Write JavaScript tests for filtering UI
- [x] 9.32 Write JavaScript tests for visual indicators and tooltips
- [x] 9.33 Validate matrix displays correct bookings for selected date range
- [x] 9.34 Validate filtering works correctly for users, desks, and parking spaces

---

## Phase 10: Booking Validation Rules

**Objective:** Implement comprehensive validation rules to prevent booking conflicts, ensuring one person cannot book multiple desks/parking spaces for overlapping periods, and one desk/parking space cannot be booked by multiple people for the same day.

**Dependencies:** Phase 2 (Desk Booking), Phase 3 (Parking Tracking), Phase 8 (User Authentication and Management)

**Priority:** High

**Estimated Effort:** 2-3 days

### Tasks

- [ ] 10.1 Design validation logic for detecting overlapping bookings for the same user
- [ ] 10.2 Implement date range overlap detection utility function
- [ ] 10.3 Create validation method in BookingService to check for existing user bookings in date range
- [ ] 10.4 Implement validation: prevent user from booking multiple desks for overlapping periods
- [ ] 10.5 Implement validation: prevent user from booking multiple parking spaces for overlapping periods
- [ ] 10.6 Create validation method to check if desk is already booked by another user for date range
- [ ] 10.7 Implement validation: prevent multiple users from booking same desk for same day
- [ ] 10.8 Create validation method to check if parking space is already booked by another user for date/time period
- [ ] 10.9 Implement validation: prevent multiple users from booking same parking space for same day/time period
- [ ] 10.10 Update desk booking creation endpoint to validate user's existing bookings
- [ ] 10.11 Update desk booking creation endpoint to validate desk availability for other users
- [ ] 10.12 Update parking reservation creation endpoint to validate user's existing reservations
- [ ] 10.13 Update parking reservation creation endpoint to validate parking space availability for other users
- [ ] 10.14 Create clear error messages for overlapping booking conflicts
- [ ] 10.15 Create clear error messages for desk/parking space already booked conflicts
- [ ] 10.16 Update frontend to display validation error messages clearly
- [ ] 10.17 Handle partial date range overlaps correctly (any date overlap triggers failure)
- [ ] 10.18 Ensure validation works for both single-day and multi-day bookings
- [ ] 10.19 Ensure validation works for parking time periods (morning, afternoon, full_day)
- [ ] 10.20 Write unit tests for date range overlap detection utility
- [ ] 10.21 Write unit tests for user booking overlap validation
- [ ] 10.22 Write unit tests for desk availability validation
- [ ] 10.23 Write unit tests for parking space availability validation
- [ ] 10.24 Write integration tests: user cannot book multiple desks for overlapping dates
- [ ] 10.25 Write integration tests: user cannot book multiple parking spaces for overlapping periods
- [ ] 10.26 Write integration tests: multiple users cannot book same desk for same day
- [ ] 10.27 Write integration tests: multiple users cannot book same parking space for same day/time period
- [ ] 10.28 Write integration tests: partial date overlaps are detected correctly
- [ ] 10.29 Write integration tests: error messages are clear and informative
- [ ] 10.30 Write JavaScript tests for frontend error message display
- [ ] 10.31 Validate that booking fails with appropriate error when user has overlapping desk booking
- [ ] 10.32 Validate that booking fails with appropriate error when desk is already booked by another user
- [ ] 10.33 Validate that parking reservation fails with appropriate error when user has overlapping reservation
- [ ] 10.34 Validate that parking reservation fails with appropriate error when space is already reserved by another user
