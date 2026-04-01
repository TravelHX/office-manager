# Office Manager

## Document Purpose

This file (`README.md`) lives **only in the project root**. It documents **functionality that has been implemented** (what works today), how to use it, and where it is deployed. It does not describe the full intended product; for that see `docs/spec.md`. For work remaining to reach the specification, see `docs/todo.md`.

## Deployed Application

**Live Application:** https://hx-hub-d-office-manager-app.azurewebsites.net/

## Project Overview

Office Manager is a web application designed to manage office operations and resources. The application provides tools for tracking and managing desk bookings, parking spaces, and overtime hours.

## Currently Implemented Features

### Desk Booking

- View available desks for selected date ranges
- Book desks for single or multiple days
- View and manage personal desk bookings
- Cancel own bookings
- Admin can view all bookings and cancel any booking

### Parking Space Reservation

- View available parking spaces for selected dates and time periods (morning, afternoon, full day)
- Reserve parking spaces
- View and manage personal parking reservations
- Cancel own reservations
- Admin can view all reservations and cancel any reservation

### Overtime Tracking

- Record overtime hours with automatic calculation
- View overtime history
- Generate overtime reports
- Admin can view all overtime records

### Admin Dashboard

- Configure number of desks and parking spaces
- View all bookings, reservations, and overtime records
- Cancel any user's bookings or reservations
- Manage office resources

### User Dashboard

- View summary statistics (active bookings, reservations, overtime hours)
- Quick access to booking and reservation features
- Unified "My Bookings" view showing all personal bookings, reservations, and overtime records

## User Guide

### Introduction

Welcome to Office Manager. The sections below describe how to use desk bookings, parking reservations, and overtime tracking.

### Getting Started

#### Accessing the Application

1. Open your web browser
2. Go to **https://hx-hub-d-office-manager-app.azurewebsites.net/** (or the URL your administrator provides)
3. The application will authenticate you automatically

#### Navigation

The main navigation menu is at the top of every page:

- **Home** - Dashboard with summary statistics
- **Desk Booking** - Book and manage desk reservations
- **Parking** - Reserve parking spaces
- **Overtime** - Record and track overtime hours
- **My Bookings** - View all your bookings, reservations, and overtime records
- **Admin** - Administrative functions (admin users only)

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

### Overtime Tracking

#### Recording Overtime

1. Click **Overtime** in the navigation menu
2. Fill in the form:
   - **Date** - The date you worked overtime
   - **Start Time** - When overtime began (e.g. 17:00)
   - **End Time** - When overtime ended (e.g. 18:00)
   - **Description** - Optional description of work performed
3. Total hours are calculated automatically
4. Click **Record Overtime** to save

**Note:** You can only record overtime for past dates, not future dates.

#### Viewing Overtime History

1. Click **My Bookings** in the navigation menu
2. Your overtime records appear in the "Overtime Records" section
3. Each record shows date, start and end times, total hours, description, and status (pending, approved, or rejected)

#### Editing Overtime Records

1. Go to the **Overtime** page
2. View your overtime history
3. Click **Edit** on the record you want to change
4. Update the details and save

**Note:** You can only edit records with "pending" status.

### My Bookings Page

The **My Bookings** page is a unified view of all your reservations and records.

- **Search** - Search across bookings, reservations, and overtime records
- **Filter by Status** - Active, cancelled, pending, or approved
- **Filter by Type** - Desk bookings, parking reservations, or overtime records
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
- **Overtime Hours** - Total approved overtime hours for the current month
- **Upcoming Items** - Your next five upcoming bookings and reservations

### Tips and Best Practices

1. **Plan ahead** - Book desks and parking in advance when possible
2. **Check availability** - Use Check Availability before booking
3. **Cancel early** - Release resources you no longer need
4. **Record overtime promptly** - Enter hours soon after working
5. **Use search** - Search and filters help you find items quickly

### Troubleshooting

#### I can't see any available desks or parking spaces

- Check that dates are valid (not in the past where the app disallows it)
- Try different dates or time periods
- The resource may be fully booked for your selection

#### I can't cancel my booking

- Only active bookings can be cancelled
- If status is "Cancelled", it is already cancelled
- Contact an administrator if you still need help

#### My overtime record shows "pending"

- Overtime may require administrator approval
- Pending records can often be edited or deleted
- Once approved or rejected, records may not be editable

#### Authentication errors

- Use the correct application URL
- Contact your administrator if problems continue

### Admin Features

If you have admin privileges:

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

#### Viewing Overtime Records

1. Open **Admin**
2. Open the **All Overtime Records** tab
3. View all overtime records for all users
4. Review and approve or reject overtime records

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

## Recent Implementation Updates

- Phase 1-6: Complete implementation of core features (desk booking, parking tracking, overtime tracking, admin functionality, integration and polish)
- All core booking and reservation features are fully functional
- Admin dashboard with comprehensive management capabilities
- User dashboard with unified booking view
- Search and filtering across all features
- Notification system for user feedback
