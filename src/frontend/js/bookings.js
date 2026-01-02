// Bookings page JavaScript

let allBookings = [];
let allReservations = [];
let allOvertimeRecords = [];

document.addEventListener('DOMContentLoaded', () => {
    loadBookings();
    
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const typeFilter = document.getElementById('type-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterBookings);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', filterBookings);
    }
    if (typeFilter) {
        typeFilter.addEventListener('change', filterBookings);
    }
});

async function loadBookings() {
    const container = document.getElementById('bookings-container');
    container.innerHTML = '<p>Loading bookings...</p>';
    
    try {
        const [bookings, reservations, overtimeRecords] = await Promise.all([
            apiRequest('/api/bookings/my-bookings'),
            apiRequest('/api/parking-reservations/my-reservations'),
            apiRequest('/api/overtime/my-overtime'),
        ]);
        
        allBookings = bookings;
        allReservations = reservations;
        allOvertimeRecords = overtimeRecords;
        
        filterBookings();
    } catch (error) {
        showError('Failed to load bookings: ' + error.message);
        container.innerHTML = '<p>Failed to load bookings.</p>';
    }
}

function filterBookings() {
    const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('status-filter')?.value || '';
    const typeFilter = document.getElementById('type-filter')?.value || '';
    
    let filteredBookings = allBookings;
    let filteredReservations = allReservations;
    let filteredOvertimeRecords = allOvertimeRecords;
    
    if (statusFilter) {
        filteredBookings = filteredBookings.filter(b => b.status === statusFilter);
        filteredReservations = filteredReservations.filter(r => r.status === statusFilter);
        filteredOvertimeRecords = filteredOvertimeRecords.filter(o => o.status === statusFilter);
    }
    
    if (typeFilter === 'booking') {
        filteredReservations = [];
        filteredOvertimeRecords = [];
    } else if (typeFilter === 'reservation') {
        filteredBookings = [];
        filteredOvertimeRecords = [];
    } else if (typeFilter === 'overtime') {
        filteredBookings = [];
        filteredReservations = [];
    }
    
    if (searchTerm) {
        filteredBookings = filteredBookings.filter(b => 
            (b.deskNumber && b.deskNumber.toLowerCase().includes(searchTerm)) ||
            (b.location && b.location.toLowerCase().includes(searchTerm)) ||
            (b.startDate && b.startDate.includes(searchTerm)) ||
            (b.endDate && b.endDate.includes(searchTerm))
        );
        
        filteredReservations = filteredReservations.filter(r =>
            (r.spaceNumber && r.spaceNumber.toLowerCase().includes(searchTerm)) ||
            (r.location && r.location.toLowerCase().includes(searchTerm)) ||
            (r.reservationDate && r.reservationDate.includes(searchTerm)) ||
            (r.timePeriod && r.timePeriod.toLowerCase().includes(searchTerm))
        );
        
        filteredOvertimeRecords = filteredOvertimeRecords.filter(o =>
            (o.recordDate && o.recordDate.includes(searchTerm)) ||
            (o.description && o.description.toLowerCase().includes(searchTerm)) ||
            (o.startTime && o.startTime.includes(searchTerm)) ||
            (o.endTime && o.endTime.includes(searchTerm))
        );
    }
    
    if (filteredBookings.length === 0 && filteredReservations.length === 0 && filteredOvertimeRecords.length === 0) {
        const container = document.getElementById('bookings-container');
        container.innerHTML = '<p>No items match your search criteria.</p>';
        return;
    }
    
    displayBookings(filteredBookings, filteredReservations, filteredOvertimeRecords);
}

function displayBookings(bookings, reservations, overtimeRecords) {
    const container = document.getElementById('bookings-container');
    
    let html = '<h3>My Bookings</h3>';
    
    if (bookings.length > 0) {
        html += `
            <h4>Desk Bookings</h4>
            <table>
                <thead>
                    <tr>
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
                            <td><strong>Desk ${booking.deskNumber}</strong></td>
                            <td>${booking.location || 'N/A'}</td>
                            <td>${formatDate(booking.startDate)}</td>
                            <td>${formatDate(booking.endDate)}</td>
                            <td>
                                <span class="status-badge status-${booking.status}">${booking.status}</span>
                            </td>
                            <td>
                                ${booking.status === 'active' ? `
                                    <button class="btn-danger cancel-booking-btn" data-booking-id="${booking.id}">
                                        Cancel
                                    </button>
                                ` : '<span class="text-muted">Cancelled</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    if (reservations.length > 0) {
        html += `
            <h4 style="margin-top: 2rem;">Parking Reservations</h4>
            <table>
                <thead>
                    <tr>
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
                            <td><strong>Space ${reservation.spaceNumber}</strong></td>
                            <td>${reservation.location || 'N/A'}</td>
                            <td>${formatDate(reservation.reservationDate)}</td>
                            <td>${formatTimePeriod(reservation.timePeriod)}</td>
                            <td>
                                <span class="status-badge status-${reservation.status}">${reservation.status}</span>
                            </td>
                            <td>
                                ${reservation.status === 'active' ? `
                                    <button class="btn-danger cancel-reservation-btn" data-reservation-id="${reservation.id}">
                                        Cancel
                                    </button>
                                ` : '<span class="text-muted">Cancelled</span>'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    if (overtimeRecords.length > 0) {
        html += `
            <h4 style="margin-top: 2rem;">Overtime Records</h4>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Start Time</th>
                        <th>End Time</th>
                        <th>Total Hours</th>
                        <th>Description</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${overtimeRecords.map(record => `
                        <tr>
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
    }
    
    container.innerHTML = html;
    
    document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const bookingId = btn.getAttribute('data-booking-id');
            cancelBooking(bookingId);
        });
    });
    
    document.querySelectorAll('.cancel-reservation-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const reservationId = btn.getAttribute('data-reservation-id');
            cancelReservation(reservationId);
        });
    });
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

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }
    
    try {
        await apiRequest(`/api/bookings/${bookingId}`, {
            method: 'DELETE',
        });
        
        showSuccess('Booking cancelled successfully!');
        loadBookings();
    } catch (error) {
        showError('Failed to cancel booking: ' + error.message);
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
        return;
    }
    
    try {
        await apiRequest(`/api/parking-reservations/${reservationId}`, {
            method: 'DELETE',
        });
        
        showSuccess('Reservation cancelled successfully!');
        loadBookings();
    } catch (error) {
        showError('Failed to cancel reservation: ' + error.message);
    }
}

function formatTimePeriod(period) {
    const labels = {
        morning: 'Morning',
        afternoon: 'Afternoon',
        full_day: 'Full Day',
    };
    return labels[period] || period;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function showError(message) {
    if (typeof showErrorNotification !== 'undefined') {
        showErrorNotification(message);
    } else {
        const container = document.getElementById('bookings-container');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        container.insertBefore(errorDiv, container.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

function showSuccess(message) {
    if (typeof showSuccessNotification !== 'undefined') {
        showSuccessNotification(message);
    } else {
        const container = document.getElementById('bookings-container');
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.textContent = message;
        container.insertBefore(successDiv, container.firstChild);
        
        setTimeout(() => {
            successDiv.remove();
        }, 5000);
    }
}

