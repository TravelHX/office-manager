# Office Manager

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

## Usage

### Accessing the Application

Visit the deployed application at: https://hx-hub-d-office-manager-app.azurewebsites.net/

### Booking a Desk

1. Navigate to "Desk Booking" from the main menu
2. Select start date and end date
3. Click "Check Availability" to see available desks
4. Click "Book" on the desired desk
5. Booking confirmation will be displayed

### Reserving a Parking Space

1. Navigate to "Parking" from the main menu
2. Select date and time period (morning, afternoon, or full day)
3. Click "Check Availability" to see available parking spaces
4. Click "Reserve" on the desired parking space
5. Reservation confirmation will be displayed

### Recording Overtime

1. Navigate to "Overtime" from the main menu
2. Enter date, start time, end time, and optional description
3. Total hours are calculated automatically
4. Click "Submit" to save the overtime record

### Viewing Bookings

- Navigate to "My Bookings" to see all your bookings, reservations, and overtime records
- Use search and filter options to find specific items
- Cancel bookings or reservations directly from the list

## Technology Stack

- **Backend:** Node.js with Express
- **Database:** MySQL with raw SQL queries
- **Frontend:** HTML, CSS, JavaScript (vanilla JS)
- **Containerization:** Docker
- **Deployment:** Azure App Service

## API Documentation

For detailed API documentation and specification, see `docs/spec.md`.

## Recent Implementation Updates

- Phase 1-6: Complete implementation of core features (desk booking, parking tracking, overtime tracking, admin functionality, integration and polish)
- All core booking and reservation features are fully functional
- Admin dashboard with comprehensive management capabilities
- User dashboard with unified booking view
- Search and filtering across all features
- Notification system for user feedback
