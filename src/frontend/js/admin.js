// Admin Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadConfiguration();
    loadAllDesks();
    loadAllParkingSpaces();
    loadAllBookings();
    loadAllParkingReservations();
    loadAllOvertimeRecords();
    
    // Check if user is admin and show user management tab
    if (typeof isAdmin !== 'undefined' && isAdmin()) {
        const usersTabBtn = document.getElementById('users-tab-btn');
        if (usersTabBtn) {
            usersTabBtn.style.display = 'block';
            loadAllUsers();
        }
    }
    
    document.getElementById('saveConfigurationBtn').addEventListener('click', saveConfiguration);
    
    // User management event listeners
    const createUserBtn = document.getElementById('createUserBtn');
    if (createUserBtn) {
        createUserBtn.addEventListener('click', createUser);
    }
    
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', changePassword);
    }
});

function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetContent = document.getElementById(`${targetTab}-tab`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
            
            // Reload users when users tab is opened
            if (targetTab === 'users' && typeof isAdmin !== 'undefined' && isAdmin()) {
                loadAllUsers();
            }
        });
    });
}

async function loadConfiguration() {
    try {
        const config = await apiRequest('/api/admin/configuration');
        document.getElementById('deskCount').value = config.deskCount || 0;
        document.getElementById('parkingCount').value = config.parkingCount || 0;
    } catch (error) {
        showError('Failed to load configuration: ' + error.message, 'configuration-message');
    }
}

async function saveConfiguration() {
    const deskCount = parseInt(document.getElementById('deskCount').value);
    const parkingCount = parseInt(document.getElementById('parkingCount').value);
    const deskNumberingMode = document.getElementById('deskNumberingMode').value;
    const parkingNumberingMode = document.getElementById('parkingNumberingMode').value;
    const deskStartNumber = parseInt(document.getElementById('deskStartNumber').value) || 1;
    const parkingStartNumber = parseInt(document.getElementById('parkingStartNumber').value) || 1;
    const messageDiv = document.getElementById('configuration-message');
    
    if (isNaN(deskCount) || isNaN(parkingCount)) {
        showNotification('Please enter valid numbers for desk and parking counts', 'error');
        return;
    }
    
    if (deskCount < 0 || parkingCount < 0) {
        showNotification('Counts cannot be negative', 'error');
        return;
    }
    
    try {
        await Promise.all([
            apiRequest('/api/admin/configuration/desk-count', {
                method: 'PUT',
                body: { 
                    deskCount,
                    numberingMode: deskNumberingMode,
                    startNumber: deskStartNumber,
                },
            }),
            apiRequest('/api/admin/configuration/parking-count', {
                method: 'PUT',
                body: { 
                    parkingCount,
                    numberingMode: parkingNumberingMode,
                    startNumber: parkingStartNumber,
                },
            }),
        ]);
        
        showNotification('Configuration saved successfully!', 'success');
        loadAllDesks();
        loadAllParkingSpaces();
    } catch (error) {
        if (error.message.includes('cannot reduce')) {
            showNotification(error.message, 'error');
        } else {
            showNotification('Failed to save configuration: ' + error.message, 'error');
        }
    }
}

async function loadAllBookings() {
    const container = document.getElementById('all-bookings-container');
    container.innerHTML = '<p>Loading bookings...</p>';
    
    try {
        const bookings = await apiRequest('/api/admin/bookings');
        
        if (bookings.length === 0) {
            container.innerHTML = '<p>No bookings found.</p>';
            return;
        }
        
        displayAllBookings(bookings);
    } catch (error) {
        showError('Failed to load bookings: ' + error.message, 'all-bookings-container');
        container.innerHTML = '<p>Failed to load bookings.</p>';
    }
}

function displayAllBookings(bookings) {
    const container = document.getElementById('all-bookings-container');
    
    const bookingsHTML = `
        <table>
            <thead>
                <tr>
                    <th>User</th>
                    <th>Desk Number</th>
                    <th>Location</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${bookings.map(booking => `
                    <tr>
                        <td>${booking.username || 'N/A'}</td>
                        <td><strong>Desk ${booking.deskNumber}</strong></td>
                        <td>${booking.location || 'N/A'}</td>
                        <td>${formatDate(booking.startDate)}</td>
                        <td>${formatDate(booking.endDate)}</td>
                        <td>
                            <span class="status-badge status-${booking.status}">${booking.status}</span>
                        </td>
                        <td>
                            ${booking.status === 'active' ? `
                                <button class="btn-danger admin-cancel-booking-btn" data-booking-id="${booking.id}">
                                    Cancel
                                </button>
                            ` : '<span class="text-muted">Cancelled</span>'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = bookingsHTML;
    
    document.querySelectorAll('.admin-cancel-booking-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bookingId = btn.getAttribute('data-booking-id');
            cancelBookingAsAdmin(bookingId);
        });
    });
}

async function cancelBookingAsAdmin(bookingId) {
    const reason = prompt('Enter cancellation reason (optional):');
    
    if (reason === null) {
        return;
    }
    
    try {
        await apiRequest(`/api/admin/bookings/${bookingId}`, {
            method: 'DELETE',
            body: { reason: reason || null },
        });
        
        showSuccess('Booking cancelled successfully!');
        loadAllBookings();
    } catch (error) {
        showError('Failed to cancel booking: ' + error.message);
    }
}

async function loadAllParkingReservations() {
    const container = document.getElementById('all-parking-container');
    container.innerHTML = '<p>Loading parking reservations...</p>';
    
    try {
        const reservations = await apiRequest('/api/admin/parking-reservations');
        
        if (reservations.length === 0) {
            container.innerHTML = '<p>No parking reservations found.</p>';
            return;
        }
        
        displayAllParkingReservations(reservations);
    } catch (error) {
        showError('Failed to load parking reservations: ' + error.message, 'all-parking-container');
        container.innerHTML = '<p>Failed to load parking reservations.</p>';
    }
}

function displayAllParkingReservations(reservations) {
    const container = document.getElementById('all-parking-container');
    
    const reservationsHTML = `
        <table>
            <thead>
                <tr>
                    <th>User</th>
                    <th>Space Number</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Time Period</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${reservations.map(reservation => `
                    <tr>
                        <td>${reservation.username || 'N/A'}</td>
                        <td><strong>Space ${reservation.spaceNumber}</strong></td>
                        <td>${reservation.location || 'N/A'}</td>
                        <td>${formatDate(reservation.reservationDate)}</td>
                        <td>${formatTimePeriod(reservation.timePeriod)}</td>
                        <td>
                            <span class="status-badge status-${reservation.status}">${reservation.status}</span>
                        </td>
                        <td>
                            ${reservation.status === 'active' ? `
                                <button class="btn-danger admin-cancel-reservation-btn" data-reservation-id="${reservation.id}">
                                    Cancel
                                </button>
                            ` : '<span class="text-muted">Cancelled</span>'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = reservationsHTML;
    
    document.querySelectorAll('.admin-cancel-reservation-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reservationId = btn.getAttribute('data-reservation-id');
            cancelReservationAsAdmin(reservationId);
        });
    });
}

async function cancelReservationAsAdmin(reservationId) {
    const reason = prompt('Enter cancellation reason (optional):');
    
    if (reason === null) {
        return;
    }
    
    try {
        await apiRequest(`/api/admin/parking-reservations/${reservationId}`, {
            method: 'DELETE',
            body: { reason: reason || null },
        });
        
        showSuccess('Reservation cancelled successfully!');
        loadAllParkingReservations();
    } catch (error) {
        showError('Failed to cancel reservation: ' + error.message);
    }
}

async function loadAllOvertimeRecords() {
    const container = document.getElementById('all-overtime-container');
    container.innerHTML = '<p>Loading overtime records...</p>';
    
    try {
        const records = await apiRequest('/api/admin/overtime-records');
        
        if (records.length === 0) {
            container.innerHTML = '<p>No overtime records found.</p>';
            return;
        }
        
        displayAllOvertimeRecords(records);
    } catch (error) {
        showError('Failed to load overtime records: ' + error.message, 'all-overtime-container');
        container.innerHTML = '<p>Failed to load overtime records.</p>';
    }
}

function displayAllOvertimeRecords(records) {
    const container = document.getElementById('all-overtime-container');
    
    const recordsHTML = `
        <table>
            <thead>
                <tr>
                    <th>User</th>
                    <th>Date</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Total Hours</th>
                    <th>Description</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${records.map(record => `
                    <tr>
                        <td>${record.username || 'N/A'}</td>
                        <td>${formatDate(record.recordDate)}</td>
                        <td>${formatTime(record.startTime)}</td>
                        <td>${formatTime(record.endTime)}</td>
                        <td>${record.totalHours} hours</td>
                        <td>${record.description || 'N/A'}</td>
                        <td>
                            <span class="status-badge status-${record.status}">${record.status}</span>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = recordsHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(timeString) {
    if (!timeString) return 'N/A';
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString;
    
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${displayHours}:${minutes} ${ampm}`;
}

function formatTimePeriod(period) {
    const labels = {
        morning: 'Morning',
        afternoon: 'Afternoon',
        full_day: 'Full Day',
    };
    return labels[period] || period;
}

async function loadAllDesks() {
    const container = document.getElementById('all-desks-container');
    container.innerHTML = '<p>Loading desks...</p>';
    
    try {
        const desks = await apiRequest('/api/admin/desks');
        
        if (desks.length === 0) {
            container.innerHTML = '<p>No desks found.</p>';
            return;
        }
        
        displayAllDesks(desks);
    } catch (error) {
        showNotification('Failed to load desks: ' + error.message, 'error');
        container.innerHTML = '<p>Failed to load desks.</p>';
    }
}

function displayAllDesks(desks) {
    const container = document.getElementById('all-desks-container');
    
    const desksHTML = `
        <table>
            <thead>
                <tr>
                    <th>Desk Number</th>
                    <th>Location</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${desks.map(desk => `
                    <tr>
                        <td><strong>Desk ${desk.deskNumber}</strong></td>
                        <td>${desk.location || 'N/A'}</td>
                        <td>${desk.description || 'N/A'}</td>
                        <td>
                            <span class="status-badge status-${desk.isActive ? 'active' : 'cancelled'}">
                                ${desk.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <button class="btn-primary assign-desk-number-btn" data-desk-id="${desk.id}" data-desk-number="${desk.deskNumber}">
                                Change Number
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = desksHTML;
    
    document.querySelectorAll('.assign-desk-number-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const deskId = btn.getAttribute('data-desk-id');
            const currentNumber = btn.getAttribute('data-desk-number');
            assignDeskNumber(deskId, currentNumber);
        });
    });
}

async function assignDeskNumber(deskId, currentNumber) {
    const newNumber = prompt(`Enter new desk number (current: ${currentNumber}):`, currentNumber);
    
    if (!newNumber || newNumber.trim() === '') {
        return;
    }
    
    try {
        await apiRequest(`/api/admin/desks/${deskId}/number`, {
            method: 'PUT',
            body: { deskNumber: newNumber.trim() },
        });
        
        showNotification('Desk number updated successfully!', 'success');
        loadAllDesks();
    } catch (error) {
        showNotification('Failed to update desk number: ' + error.message, 'error');
    }
}

async function loadAllParkingSpaces() {
    const container = document.getElementById('all-parking-spaces-container');
    container.innerHTML = '<p>Loading parking spaces...</p>';
    
    try {
        const spaces = await apiRequest('/api/admin/parking-spaces');
        
        if (spaces.length === 0) {
            container.innerHTML = '<p>No parking spaces found.</p>';
            return;
        }
        
        displayAllParkingSpaces(spaces);
    } catch (error) {
        showNotification('Failed to load parking spaces: ' + error.message, 'error');
        container.innerHTML = '<p>Failed to load parking spaces.</p>';
    }
}

function displayAllParkingSpaces(spaces) {
    const container = document.getElementById('all-parking-spaces-container');
    
    const spacesHTML = `
        <table>
            <thead>
                <tr>
                    <th>Space Number</th>
                    <th>Location</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${spaces.map(space => `
                    <tr>
                        <td><strong>Space ${space.spaceNumber}</strong></td>
                        <td>${space.location || 'N/A'}</td>
                        <td>${space.description || 'N/A'}</td>
                        <td>
                            <span class="status-badge status-${space.isActive ? 'active' : 'cancelled'}">
                                ${space.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <button class="btn-primary assign-space-number-btn" data-space-id="${space.id}" data-space-number="${space.spaceNumber}">
                                Change Number
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = spacesHTML;
    
    document.querySelectorAll('.assign-space-number-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const spaceId = btn.getAttribute('data-space-id');
            const currentNumber = btn.getAttribute('data-space-number');
            assignParkingSpaceNumber(spaceId, currentNumber);
        });
    });
}

async function assignParkingSpaceNumber(spaceId, currentNumber) {
    const newNumber = prompt(`Enter new parking space number (current: ${currentNumber}):`, currentNumber);
    
    if (!newNumber || newNumber.trim() === '') {
        return;
    }
    
    try {
        await apiRequest(`/api/admin/parking-spaces/${spaceId}/number`, {
            method: 'PUT',
            body: { spaceNumber: newNumber.trim() },
        });
        
        showNotification('Parking space number updated successfully!', 'success');
        loadAllParkingSpaces();
    } catch (error) {
        showNotification('Failed to update parking space number: ' + error.message, 'error');
    }
}

function showError(message, containerId = 'admin-container') {
    showNotification(message, 'error');
}

function showSuccess(message, containerId = 'admin-container') {
    showNotification(message, 'success');
}

async function createUser() {
    const username = document.getElementById('newUsername').value.trim();
    const firstName = document.getElementById('newFirstName').value.trim();
    const lastName = document.getElementById('newLastName').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const officeLocation = document.getElementById('newOfficeLocation').value;
    const password = document.getElementById('newPassword').value;
    const isAdmin = document.getElementById('newIsAdmin').checked;
    const role = document.getElementById('newRole').value;
    const messageDiv = document.getElementById('create-user-message');
    
    if (!username || !email || !password) {
        messageDiv.innerHTML = '<div class="error">Please fill in all required fields (Username, Email, Password)</div>';
        return;
    }
    
    try {
        const body = {
            username,
            email,
            password,
            role: isAdmin ? 'admin' : role,
        };

        if (firstName) {
            body.first_name = firstName;
        }
        if (lastName) {
            body.last_name = lastName;
        }
        if (officeLocation) {
            body.office_location = officeLocation;
        }
        if (isAdmin) {
            body.is_admin = true;
        }

        const response = await apiRequest('/api/auth/users', {
            method: 'POST',
            body: body,
        });
        
        messageDiv.innerHTML = '<div class="success">User created successfully!</div>';
        
        // Reload user list
        loadAllUsers();
        
        // Clear form
        document.getElementById('newUsername').value = '';
        document.getElementById('newFirstName').value = '';
        document.getElementById('newLastName').value = '';
        document.getElementById('newEmail').value = '';
        document.getElementById('newOfficeLocation').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newIsAdmin').checked = false;
        document.getElementById('newRole').value = 'user';
    } catch (error) {
        messageDiv.innerHTML = `<div class="error">Failed to create user: ${error.message}</div>`;
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPasswordChange').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const messageDiv = document.getElementById('change-password-message');
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        messageDiv.innerHTML = '<div class="error">Please fill in all fields</div>';
        return;
    }
    
    if (newPassword !== confirmPassword) {
        messageDiv.innerHTML = '<div class="error">New passwords do not match</div>';
        return;
    }
    
    try {
        await apiRequest('/api/auth/users/password', {
            method: 'PUT',
            body: { currentPassword, newPassword },
        });
        
        messageDiv.innerHTML = '<div class="success">Password changed successfully!</div>';
        
        // Clear form
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPasswordChange').value = '';
        document.getElementById('confirmPassword').value = '';
    } catch (error) {
        messageDiv.innerHTML = `<div class="error">Failed to change password: ${error.message}</div>`;
    }
}

async function loadAllUsers() {
    const container = document.getElementById('all-users-container');
    if (!container) return;
    
    container.innerHTML = '<p>Loading users...</p>';
    
    try {
        const users = await apiRequest('/api/auth/users');
        
        if (users.length === 0) {
            container.innerHTML = '<p>No users found.</p>';
            return;
        }
        
        displayAllUsers(users);
    } catch (error) {
        showNotification('Failed to load users: ' + error.message, 'error');
        container.innerHTML = '<p>Failed to load users.</p>';
    }
}

async function displayAllUsers(users) {
    const container = document.getElementById('all-users-container');
    if (!container) return;
    
    // Count admin users to determine if we can delete admins
    const adminCount = users.filter(u => u.isAdmin).length;
    
    const usersHTML = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Office Location</th>
                    <th>Role</th>
                    <th>Admin</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => {
                    const isLastAdmin = user.isAdmin && adminCount === 1;
                    const displayName = user.firstName && user.lastName 
                        ? `${user.firstName} ${user.lastName}` 
                        : user.firstName || user.lastName || 'N/A';
                    return `
                    <tr class="${isLastAdmin ? 'last-admin-user' : ''}">
                        <td>${user.id}</td>
                        <td><strong>${user.username}</strong></td>
                        <td>${displayName}</td>
                        <td>${user.email}</td>
                        <td>${user.officeLocation || 'N/A'}</td>
                        <td>
                            <span class="status-badge ${user.role === 'admin' ? 'status-approved' : 'status-active'}">
                                ${user.role}
                            </span>
                        </td>
                        <td>
                            ${user.isAdmin ? '<span class="status-badge status-approved">Yes</span>' : '<span class="status-badge status-pending">No</span>'}
                        </td>
                        <td>
                            ${isLastAdmin 
                                ? '<span class="text-muted" title="Cannot delete the last admin user">Delete Disabled</span>' 
                                : `<button class="btn-danger delete-user-btn" data-user-id="${user.id}" data-username="${user.username}">Delete</button>`
                            }
                        </td>
                    </tr>
                `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    container.innerHTML = usersHTML;
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            const username = btn.getAttribute('data-username');
            deleteUser(userId, username);
        });
    });
}

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}" (ID: ${userId})?\n\nThis will also delete all associated bookings, reservations, and overtime records.`)) {
        return;
    }
    
    const messageDiv = document.getElementById('users-message');
    messageDiv.innerHTML = '<p>Deleting user...</p>';
    
    try {
        await apiRequest(`/api/auth/users/${userId}`, {
            method: 'DELETE',
        });
        
        messageDiv.innerHTML = '<div class="success">User deleted successfully!</div>';
        loadAllUsers();
    } catch (error) {
        if (error.message.includes('last admin user')) {
            messageDiv.innerHTML = `<div class="error">Cannot delete user: ${error.message}</div>`;
        } else if (error.message.includes('not found')) {
            messageDiv.innerHTML = `<div class="error">User not found. It may have already been deleted.</div>`;
            loadAllUsers();
        } else {
            messageDiv.innerHTML = `<div class="error">Failed to delete user: ${error.message}</div>`;
        }
    }
}
