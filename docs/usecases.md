# Use Cases

This document contains all manual paths through features and user interaction flows.

## Application layout

Primary navigation is a **collapsible left sidebar** on standard pages. **Admin** uses the same pattern: admin sections appear as **vertical items in the left sidebar** (not a horizontal tab row). The **Account** control is at the **top right** of the bar: use it for **Log in** / **Register** when signed out, or for user details and **Log out** when signed in. The **menu** icon in the top bar toggles the sidebar.

## Use Case: View release history from footer

**Description:** A user wants to see what changed in deployed builds.

**Steps:**
1. Open any page that shows the app shell and footer
2. Locate **Version:** in the footer
3. Click the version number (hyperlink)
4. The **Release history** page opens and displays text loaded from server data (`data/release_history.txt`)

**Expected Result:** Release history content is visible (or an empty file message if the file is empty).

**Manual testing path:**
1. Open Home or Login
2. Click the version link in the footer
3. Confirm the Release history page title and that body text matches the deployed `release_history.txt`

**Automated coverage:** `src/frontend/tests/version.test.js` (footer markup and version fetch); `tests/integration/release-history.test.js` (**GET /api/release-history**).

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

## Use Case 8: Admin Provisions User and User Completes Profile

**Description:** An administrator adds a new colleague using only email and name. The colleague opens a setup link, sets a password and office location, then logs in and can use desk booking and other protected features.

**Steps:**
1. Admin logs in and opens the Admin dashboard
2. Admin opens the User Management tab
3. Admin enters the new user's full name and email (and optional admin/role options)
4. Admin creates the user and copies the profile setup link from the success message
5. Admin shares the link with the new user through a secure channel
6. New user opens the link; the application validates the token and shows the completion form
7. New user selects office location, enters and confirms password, and submits
8. System stores password and office, marks profile complete, and clears the invitation token
9. New user logs in with email and password
10. New user can access desk booking, parking, overtime, and other protected features as allowed by role

**Expected Result:** The new user is active with a complete profile. Users who have not completed setup cannot perform protected actions until they finish the flow.

**Manual Testing Path:**
1. Log in as an administrator
2. Go to Admin, then User Management
3. Create a user with a test email and name; confirm a setup link appears in the success message
4. Open the setup link in a private or separate browser session (or after logging out)
5. Confirm email is shown, enter office location and password, submit
6. Log in as that user with the email and new password
7. Confirm a protected action (e.g. desk booking availability or booking) works
8. Optional: create a second provisioned user, do not complete setup, confirm protected APIs or UI block access until setup is done

---

## Use Case 9: First User Registers and Becomes Administrator

**Description:** On a freshly started application with no users, the first person to open the site is routed to a registration screen. They create an account and are automatically granted administrator privileges. After the first account exists, self-service registration is closed: anyone visiting the registration page sees an informational message directing them to log in or contact an administrator.

**Steps:**
1. The application starts on a clean database (no users); startup cleanup removes any legacy admin/password123 user and, if a pre-existing admin user is found, flushes all users
2. A visitor opens the site and is routed to the registration screen (because no users exist)
3. The visitor enters first name, last name, email, office location, password, and confirm password, then submits
4. The system creates the first user with admin role and returns a session token
5. The first user is signed in and can reach admin features (User Management, Resource Configuration, All Bookings, and so on)
6. A second visitor opens the registration page
7. The registration page detects that users exist; it hides the form and shows a "self-service registration is not available" message with a link to the login page
8. If that second visitor instead posts directly to `POST /api/auth/register`, the API responds `403 REGISTRATION_CLOSED`
9. The administrator creates accounts for new colleagues through User Management (Use Case 8) rather than via self-registration

**Expected Result:** The first registered user is always admin; subsequent visitors cannot self-register. Accounts for additional users are provisioned by an existing administrator.

**Manual Testing Path:**
1. Stop the application, clear or flush users in the database, and start the application (startup cleanup runs automatically)
2. Open the site root; confirm the page shows the registration form and first-user informational message
3. Submit valid registration values and confirm redirect to the application home with admin-only areas available
4. Log out and open `/pages/register.html` directly; confirm the form is hidden and the closed-registration message with a login link is shown
5. Issue `POST /api/auth/register` with a new email via a tool such as `curl`; confirm the response is `403` with code `REGISTRATION_CLOSED`
6. Log in as the admin and use User Management to provision a second user (Use Case 8) to demonstrate the supported path after first-user registration

---
