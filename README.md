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
- Role-based access control: admin users and regular users
- Session/token management for logged-in users
- User indicator in top-left showing logged-in user information
- Access control: logged-in users can access all features; non-logged-in users can only view available desks/spaces
- Login redirect when unauthenticated users attempt to book
- Password change functionality
- Password reset with time-limited tokens (no outbound email; admin shares reset links)

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
- Admin can view all bookings and cancel any booking
- Remaining desk count displayed for selected dates (availability enhancement)
- Booking proceeds directly without confirmation modal (streamlined flow)
- Booking validation: one desk per person per period, one person per desk per day
- Clear error messages for booking conflicts and overlapping date ranges

### Parking Space Reservation

- View available parking spaces for selected dates and time periods (morning, afternoon, full day)
- Reserve parking spaces
- View and manage personal parking reservations
- Cancel own reservations
- Admin can view all reservations and cancel any reservation
- Remaining parking space count displayed for selected date and time period
- Booking validation: one parking space per person per period, one space per person per day/time
- Clear error messages for reservation conflicts

### Multi-Select Desk and Parking Booking

- Select multiple desks or parking spaces before booking
- Dual button system: "Select" (adds to selection list) and "Book" (books immediately)
- Visual selection indicators for selected items
- "Book Selected" button books all selected items for the same date range in one operation
- Selection persists when scrolling; "Clear Selection" to deselect all
- Existing single "Book" button functionality maintained

### Enhanced Admin Resource Configuration

- Auto-generate sequential desk numbers (e.g. setting 10 desks creates desks numbered 1-10)
- Auto-generate sequential parking space numbers
- Manual number assignment for specific desks and parking spaces
- Support for both auto-generated and manually assigned numbers

### Admin Dashboard

- Configure number of desks and parking spaces (with flexible numbering)
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
3. Click **Check Availability** to see available desks
4. Review the list of available desks
5. Click **Book This Desk** on your preferred desk
6. Confirm your booking

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
4. Click **Save Configuration**

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
