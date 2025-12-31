# Use Cases

This document contains all manual paths through features and user interaction flows.

## Use Case 1: Employee Books Desk for Two Days

**Description:** An employee needs to book a desk in the office for two consecutive days.

**Steps:**
1. Employee logs into the Office Manager application
2. Employee navigates to the Desk Booking section
3. Employee selects the date range (start date and end date, two days total)
4. Employee views available desks for the selected dates
5. Employee selects a desk from the available options
6. Employee confirms the booking
7. System validates the booking (desk availability, no conflicts)
8. System creates the booking and displays confirmation

**Expected Result:** Employee receives confirmation that the desk is booked for the specified two days. The desk appears as unavailable for other employees during those dates.

**Manual Testing Path:**
1. Open the application in a web browser
2. Log in as an employee user
3. Click on "Desk Booking" in the navigation menu
4. Select a start date (e.g., Monday) and end date (e.g., Tuesday) using the date picker
5. Verify that available desks are displayed
6. Click on an available desk to select it
7. Review booking details (dates, desk number/location)
8. Click "Confirm Booking" button
9. Verify success message appears
10. Verify the booking appears in "My Bookings" section
11. Log in as another employee and verify the desk shows as unavailable for the same dates

---

## Use Case 2: Employee Books Desk and Parking Space for Half Day

**Description:** An employee needs to book both a desk and a parking space for half a day (morning or afternoon).

**Steps:**
1. Employee logs into the Office Manager application
2. Employee navigates to the Desk Booking section
3. Employee selects the date and time period (morning or afternoon)
4. Employee views available desks for the selected date and time period
5. Employee selects a desk and confirms the booking
6. Employee navigates to the Parking section
7. Employee selects the same date and time period
8. Employee views available parking spaces for the selected date and time period
9. Employee selects a parking space and confirms the reservation
10. System validates both bookings
11. System creates both bookings and displays confirmation

**Expected Result:** Employee receives confirmation that both the desk and parking space are booked for the specified half day. Both resources appear as unavailable for other employees during that time period.

**Manual Testing Path:**
1. Open the application in a web browser
2. Log in as an employee user
3. Click on "Desk Booking" in the navigation menu
4. Select a date and choose "Morning" or "Afternoon" time period
5. Select an available desk and confirm the booking
6. Verify desk booking confirmation appears
7. Click on "Parking" in the navigation menu
8. Select the same date and time period (Morning/Afternoon)
9. Select an available parking space and confirm the reservation
10. Verify parking reservation confirmation appears
11. Navigate to "My Bookings" and verify both desk and parking bookings are listed
12. Verify both resources show as unavailable for another employee during the same time period

---

## Use Case 3: Employee Attempts to Book Unavailable Desk

**Description:** An employee tries to book a desk, but all desks are already booked for the requested date/time.

**Steps:**
1. Employee logs into the Office Manager application
2. Employee navigates to the Desk Booking section
3. Employee selects a date and time period
4. System checks desk availability
5. System determines no desks are available for the selected date/time
6. System displays a message indicating no desks are available
7. Employee can either select a different date/time or be added to a waitlist (if implemented)

**Expected Result:** Employee receives a clear message that no desks are available for the requested date/time. The system suggests alternative dates or times if available.

**Manual Testing Path:**
1. Open the application in a web browser
2. Log in as an employee user
3. Book all available desks for a specific date/time using multiple user accounts
4. Log in as a new employee user
5. Navigate to "Desk Booking"
6. Select the same date/time that has all desks booked
7. Verify that no desks are displayed as available
8. Verify an appropriate message is shown: "No desks available for the selected date/time"
9. Try selecting a different date/time and verify desks are available
10. Verify the system suggests alternative dates if available

---

## Use Case 4: Admin Sets Up Number of Desks and Parking Spaces

**Description:** An administrator needs to configure the total number of desks and parking spaces available in the office.

**Steps:**
1. Admin logs into the Office Manager application with admin privileges
2. Admin navigates to the Admin/Configuration section
3. Admin selects "Office Resources" or "Resource Management"
4. Admin views current desk and parking space configuration
5. Admin enters the number of desks to configure
6. Admin enters the number of parking spaces to configure
7. Admin saves the configuration
8. System validates the configuration (e.g., cannot reduce below existing bookings)
9. System updates the resource counts
10. System displays confirmation

**Expected Result:** The system updates the total number of desks and parking spaces. The new counts are reflected in availability displays for all users.

**Manual Testing Path:**
1. Open the application in a web browser
2. Log in as an administrator user
3. Navigate to "Admin" section in the navigation menu
4. Click on "Office Resources" or "Resource Configuration"
5. View current desk count and parking space count
6. Change the desk count to a new number (e.g., from 20 to 25)
7. Change the parking space count to a new number (e.g., from 15 to 20)
8. Click "Save Configuration" button
9. Verify success message appears
10. Log out and log in as a regular employee
11. Navigate to Desk Booking and verify the new desk count is reflected in available desks
12. Navigate to Parking and verify the new parking space count is reflected in available spaces
13. Test error handling: Try to reduce desk count below the number of active bookings and verify appropriate error message

---

## Use Case 5: Admin Cancels User Desk Booking

**Description:** An administrator needs to cancel a desk booking made by a user (e.g., for administrative reasons, policy violations, etc.).

**Steps:**
1. Admin logs into the Office Manager application with admin privileges
2. Admin navigates to the Admin section
3. Admin selects "Manage Bookings" or "All Bookings"
4. Admin views list of all current and upcoming bookings
5. Admin selects a specific user's desk booking
6. Admin clicks "Cancel Booking" or "Remove Booking"
7. System prompts for confirmation and reason (optional)
8. Admin confirms the cancellation
9. System cancels the booking and frees up the desk
10. System notifies the user (if notification system is implemented)
11. System displays confirmation to admin

**Expected Result:** The booking is cancelled, the desk becomes available for the previously booked dates, and the user is notified of the cancellation (if notifications are implemented).

**Manual Testing Path:**
1. Open the application in a web browser
2. Log in as an employee user and create a desk booking for a future date
3. Log out and log in as an administrator user
4. Navigate to "Admin" section
5. Click on "Manage Bookings" or "All Bookings"
6. Locate the booking created in step 2
7. Click on the booking to view details
8. Click "Cancel Booking" button
9. Enter a reason for cancellation (if prompted)
10. Confirm the cancellation
11. Verify success message appears
12. Verify the booking no longer appears in the active bookings list
13. Log out and log in as the original employee user
14. Navigate to "My Bookings" and verify the booking shows as cancelled
15. Verify the desk is now available for booking by another user

---

## Use Case 6: User Cancels Their Own Desk Booking

**Description:** An employee needs to cancel their own desk booking (e.g., change of plans, working from home).

**Steps:**
1. Employee logs into the Office Manager application
2. Employee navigates to "My Bookings" section
3. Employee views their current and upcoming bookings
4. Employee selects the desk booking they want to cancel
5. Employee clicks "Cancel Booking" button
6. System prompts for confirmation
7. Employee confirms the cancellation
8. System cancels the booking and frees up the desk
9. System displays confirmation
10. The desk becomes available for other employees

**Expected Result:** The booking is cancelled, the desk becomes available immediately, and the employee receives confirmation. The booking is removed from "My Bookings" or marked as cancelled.

**Manual Testing Path:**
1. Open the application in a web browser
2. Log in as an employee user
3. Create a desk booking for a future date
4. Navigate to "My Bookings" section
5. Locate the booking created in step 3
6. Click on the booking to view details
7. Click "Cancel Booking" button
8. Confirm the cancellation in the confirmation dialog
9. Verify success message appears
10. Verify the booking is removed from "My Bookings" or marked as cancelled
11. Navigate to "Desk Booking" and verify the desk is now available for the previously booked date
12. Log in as another employee and verify they can now book the desk for that date

---

## Use Case 7: Employee Books Desk, Parking Space, and Records Overtime

**Description:** An employee books a desk and parking space, then works overtime and needs to record the overtime hours.

**Steps:**
1. Employee logs into the Office Manager application
2. Employee navigates to Desk Booking section
3. Employee selects date and time period, views available desks, selects a desk, and confirms booking
4. Employee navigates to Parking section
5. Employee selects the same date and time period, views available parking spaces, selects a parking space, and confirms reservation
6. Employee works overtime (e.g., one additional hour)
7. Employee navigates to Overtime Tracking section
8. Employee clicks "Record Overtime" or "Add Overtime"
9. Employee enters the date, start time, end time, and total hours worked
10. Employee enters description/notes (optional)
11. Employee submits the overtime record
12. System validates the overtime record (date, time, hours)
13. System saves the overtime record
14. System displays confirmation

**Expected Result:** All three actions are completed successfully: desk booking confirmed, parking reservation confirmed, and overtime hours recorded. All three appear in the employee's dashboard/bookings.

**Manual Testing Path:**
1. Open the application in a web browser
2. Log in as an employee user
3. Navigate to "Desk Booking" and book a desk for today
4. Verify desk booking confirmation
5. Navigate to "Parking" and reserve a parking space for the same date
6. Verify parking reservation confirmation
7. Navigate to "Overtime Tracking" section
8. Click "Record Overtime" or "Add Overtime Entry"
9. Enter today's date
10. Enter start time (e.g., 5:00 PM) and end time (e.g., 6:00 PM)
11. Verify total hours calculated correctly (1 hour)
12. Enter optional description: "Extended work on project"
13. Click "Submit" or "Save"
14. Verify success message appears
15. Navigate to dashboard or "My Bookings" and verify all three items are displayed:
    - Desk booking for today
    - Parking reservation for today
    - Overtime record showing 1 hour
16. Verify overtime appears in overtime history
17. Verify overtime can be viewed in reports (if report feature is available)

---
