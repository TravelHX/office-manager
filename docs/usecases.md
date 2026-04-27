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

## Use Case 7: (Removed in Phase 23a)

The previous Use Case 7 covered combined desk, parking, and overtime actions. Overtime was removed end-to-end in Phase 23a (see `docs/spec.md` section 16). Desk and parking flows are covered individually by Use Cases 1, 2, 3, and 6. The use case number is retained to preserve stable cross-references.

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
10. New user can access desk booking, parking, and other protected features as allowed by role

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

## Use Case 10: Book Multiple Desks or Parking Spaces at Once

**Description:** A logged-in user with a completed profile wants to book more than one desk (or parking space) for the same date range without repeating the booking flow for each resource. They pick dates, select several resources, and submit a single booking request. The single-resource **Book** / **Reserve** action on each row remains available for users who only need one resource.

**Steps (desks):**
1. User signs in and opens **Desk Booking**
2. User chooses start and end dates and runs **Check Availability**; the page shows available desks with a **Select** and a **Book** button on each card
3. User clicks **Select** on each desk they want; the card shows a **Selected** indicator and the **Book Selected** control appears with a running count (e.g. "3 desks selected")
4. User scrolls the list to continue selecting; previously selected cards stay marked
5. User clicks **Book Selected**; the application issues one `POST /api/bookings/bulk` request for all selected desks and the chosen date range
6. On success the user is redirected to **My Bookings** with a success toast; the selection is cleared
7. If only a single desk is required, the user instead clicks the per-card **Book** button, which posts to `POST /api/bookings` without touching the multi-select selection

**Steps (parking):** Identical, using **Parking**, **Select** / **Reserve Selected**, and `POST /api/parking-reservations/bulk`. A per-card **Reserve** button continues to post to `POST /api/parking-reservations` when the user wants only one space.

**Expected Result:** All selected desks (or spaces) are booked for the chosen date range in one operation; partial failures are reported per resource; per-card single-booking continues to work unchanged. Selection state is held in memory and is not lost when the list is scrolled.

**Manual Testing Path:**
1. Configure at least three desks and at least three parking spaces as an admin
2. As a regular user, open **Desk Booking**, pick a date range, and run **Check Availability**
3. Click **Select** on three desks in succession; confirm the **Book Selected** control shows "3 desks selected" and each card shows a **Selected** indicator
4. Scroll the desks list; confirm the selected state on each card is unchanged
5. Click **Book Selected**; confirm a single call to `POST /api/bookings/bulk` is made and you are redirected to **My Bookings** with three new bookings
6. Return to **Desk Booking**, run availability again, and click a per-card **Book** button on one desk; confirm a single call to `POST /api/bookings` is made and the multi-select selection controls remain hidden
7. Repeat steps 2-6 on the **Parking** page using **Reserve Selected** and `POST /api/parking-reservations/bulk` / `POST /api/parking-reservations`

---

## Use Case 11: Admin Reviews and Searches the Audit Log

**Description:** An administrator needs to see who did what, when. They open the admin area, switch to the **Audit** tab, and either scroll the paginated list of recent events or use the search box to find a specific event by action type, actor email, summary text, or payload fragment (for example, a desk number or another user's email). The log is append-only: there is no edit or delete control in the UI or the API.

**Steps:**
1. Admin signs in (any admin account)
2. Admin opens the **Admin** page and clicks the **Audit** item in the sidebar. The item is visible only to admins — regular users never see it.
3. The page calls `GET /api/admin/audit-events?limit=50&offset=0` and renders the response as a table of **When / Actor / Action / Target / Summary / Payload**. Events are ordered **newest first**.
4. To page through history, admin clicks **Previous** or **Next**. The indicator shows `Showing N-M` for the current page; **Previous** is disabled on the first page and **Next** is disabled once a page returns fewer rows than the limit.
5. To find a specific event, admin types into the search box and clicks **Search**. The server does a case-insensitive substring match across the action type, the actor email, the summary, and the serialised payload. Examples that work: `USER_CREATED`, `alice@company.com`, `Booked desk 12`, or any other unique fragment that appears in any of those columns.
6. To return to the unfiltered view, admin clicks **Clear** (which empties the search box and re-issues the unfiltered fetch starting at offset 0).
7. Admin observes the log is **read-only**: there is no edit, no delete, no bulk-action control. Audit rows can only be removed via direct database tooling at the operator's discretion; the application itself never mutates an audit row after it is written.

**Expected Result:** The admin can review all meaningful actions taken by all users (including other admins) across authentication, desk bookings, parking reservations, admin configuration, user management, and bulk create flows. Search narrows the result set server-side. Non-admin callers receive `403 FORBIDDEN` on the API and never see the Audit tab.

**Manual Testing Path:**
1. Sign in as an admin
2. Provision a new user via **User Management** (this emits a `USER_CREATED` event)
3. Sign out, then sign in as a regular user and cancel one of your own desk bookings (this emits `DESK_BOOKING_CANCELLED_BY_USER`)
4. Sign back in as admin; open **Admin** → **Audit**
5. Verify the most recent events at the top of the list include the two actions you just performed, with correct **Actor** (each action's initiator) and meaningful **Summary** / **Payload** text
6. In the search box, type the new user's email from step 2 and click **Search**. Confirm the list narrows to the `USER_CREATED` event for that email. Click **Clear** to reset.
7. Repeat with a search for `DESK_BOOKING_CANCELLED_BY_USER` (action-type substring match) and confirm the cancel event from step 3 appears.
8. As a regular (non-admin) user, attempt `GET /api/admin/audit-events` with their Bearer token using a tool such as `curl`. Confirm the response is `403` with code `FORBIDDEN` and the **Audit** sidebar item does not appear for them in the UI.

**Automated coverage:** `tests/integration/audit.test.js` (GET API: authorisation, listing, search, pagination); `tests/integration/audit-emissions.test.js` (every catalogue action type lands in the table); `src/frontend/tests/admin-audit.test.js` (UI rendering, XSS escaping, pagination bounds, search wiring); `tests/e2e/audit.spec.js` (Playwright — admin opens Audit, searches, sees seeded event).

---

## Use Case 12: User Undoes a Recent Desk Booking Cancellation

**Description:** A signed-in user cancels their own desk booking from **My Bookings** and immediately realises they need it after all. They use the **Undo** toast to restore the booking, provided the short undo window has not elapsed and no other user has claimed the desk in the meantime.

**Steps:**
1. User signs in and opens **My Bookings**
2. User clicks **Cancel** on an active desk booking and accepts the confirmation dialog
3. The row changes to **Cancelled** and an **Undo** toast appears at the top of the bookings container with the message *"Booking cancelled."* and an **Undo** button
4. The client also notes the `X-Undo-Window-Ms` header from the cancel response and sets a local timer for that many milliseconds. The default window is **30 seconds** (see `BookingService.UNDO_CANCEL_WINDOW_MS`).
5. If user clicks **Undo** within the window, the client POSTs to `/api/bookings/:id/undo-cancel`. The server re-checks ownership, the window, and desk availability, then sets status back to `active` and clears cancellation metadata. The bookings list refreshes with the restored row, and a `DESK_BOOKING_RESTORED` audit event is written.
6. If the window expires first, the toast disappears and the cancellation is final.
7. If the user clicks **Undo** but another user has booked the desk for the same date range in the meantime, the server responds `409 DESK_UNAVAILABLE`, the toast dismisses, and the user sees an error message explaining the desk is no longer available. The original booking stays cancelled.
8. Attempting to undo an **admin-cancelled** booking (rare edge: user triggers undo from another path) returns `403 FORBIDDEN` with message referencing self-cancellations only.

**Expected Result:** Within a 30-second window a user can reverse their own desk cancel with a single click, subject to the desk still being available. The audit trail always records both the cancel and the restore.

**Manual Testing Path:**
1. Sign in as a user with at least one active desk booking
2. Open **My Bookings**, click **Cancel** on the booking, and accept the confirm
3. Confirm the **Undo** toast appears and the booking row shows **Cancelled**
4. Click **Undo** within 30 seconds; confirm the toast disappears and the booking row returns to **Active** with a Cancel button
5. Repeat the cancel, then wait 31+ seconds; confirm the toast auto-dismisses and the booking stays cancelled
6. Repeat the cancel with a second browser/user having a window open on the same desk for the same dates; have the second user book the desk during the first user's 30 seconds; the first user's Undo click should show *"Could not undo cancellation: Desk is no longer available…"*
7. As an admin, cancel another user's desk booking (via the All Bookings tab). As that user, open the DB / audit log and confirm no Undo affordance was available for the admin-initiated cancel — the client only shows Undo after a self-cancel.

**Automated coverage:** `tests/services/BookingService.test.js` (service rules — window, ownership, admin-cancel exclusion, re-availability); `tests/integration/undo-cancel.test.js` (full HTTP happy path + expired + taken + 403/404/400 edges + `X-Undo-Window-Ms` header); `src/frontend/tests/undo-cancel.test.js` (toast render, auto-dismiss, replace-on-second-cancel, Undo click success + failure, mid-flight disable); `tests/e2e/undo-cancel.spec.js` (Playwright — user cancels a seeded booking and successfully undoes via the toast).

---
