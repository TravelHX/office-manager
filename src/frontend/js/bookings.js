// Bookings page JavaScript

const apiRequest = (endpoint, options) => {
    const impl = globalThis.apiRequest;
    if (typeof impl !== 'function') {
        throw new Error('apiRequest is not registered; load main.js before bookings.js.');
    }
    return impl(endpoint, options);
};

let allBookings = [];
let allReservations = [];

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
        const [bookings, reservations] = await Promise.all([
            apiRequest('/api/bookings/my-bookings'),
            apiRequest('/api/parking-reservations/my-reservations'),
        ]);

        allBookings = bookings;
        allReservations = reservations;

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

    if (statusFilter) {
        filteredBookings = filteredBookings.filter(b => b.status === statusFilter);
        filteredReservations = filteredReservations.filter(r => r.status === statusFilter);
    }

    if (typeFilter === 'booking') {
        filteredReservations = [];
    } else if (typeFilter === 'reservation') {
        filteredBookings = [];
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
    }

    if (filteredBookings.length === 0 && filteredReservations.length === 0) {
        const container = document.getElementById('bookings-container');
        container.innerHTML = '<p>No items match your search criteria.</p>';
        return;
    }

    displayBookings(filteredBookings, filteredReservations);
}

function displayBookings(bookings, reservations) {
    const container = document.getElementById('bookings-container');
    
    let html = '<h3>My Bookings</h3>';
    
    if (bookings.length > 0) {
        // Phase 27c: small "Fob" badge on rows where the booking
        // included a fob request. Rendered next to the desk number so
        // the user can see at a glance which of their bookings carried
        // a fob.
        const fobBadge = '<span class="status-badge fob-badge" title="A key fob was requested with this booking">Fob</span>';
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
                            <td><strong>Desk ${booking.deskNumber}</strong>${booking.fobRequested ? ' ' + fobBadge : ''}</td>
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

// Phase 23c: Undo window for self-cancelled bookings. Mirrors
// BookingService.UNDO_CANCEL_WINDOW_MS on the server; the server also
// returns this in the `X-Undo-Window-Ms` response header so we stay in sync
// if the value is ever changed server-side.
const UNDO_CANCEL_WINDOW_MS_DEFAULT = 30_000;

async function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }

    // We need the DELETE response headers to read X-Undo-Window-Ms, so go
    // directly via fetch() for this call rather than apiRequest() (which
    // drops headers and only returns the parsed body).
    const token = (typeof globalThis.getAuthToken === 'function')
        ? globalThis.getAuthToken()
        : null;
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!response.ok) {
            let message = 'Failed to cancel booking';
            try {
                const body = await response.json();
                if (body && body.error && body.error.message) message = body.error.message;
            } catch (_) { /* empty body */ }
            throw new Error(message);
        }

        const headerMs = Number.parseInt(response.headers.get('X-Undo-Window-Ms'), 10);
        const windowMs = Number.isFinite(headerMs) && headerMs > 0
            ? headerMs
            : UNDO_CANCEL_WINDOW_MS_DEFAULT;

        // Await the list re-render FIRST; loadBookings rewrites the container's
        // innerHTML, which would otherwise wipe a toast we inserted beforehand.
        await loadBookings();
        showUndoCancelToast(bookingId, windowMs);
    } catch (error) {
        showError('Failed to cancel booking: ' + error.message);
    }
}

/**
 * Phase 23c: Render a dismissible toast with an Undo button that auto-hides
 * when the server-side undo window expires. Clicking Undo POSTs to
 * /api/bookings/:id/undo-cancel and refreshes the bookings list on success.
 */
function showUndoCancelToast(bookingId, windowMs) {
    const container = document.getElementById('bookings-container');
    if (!container) {
        // Defensive: if the container isn't mounted for some reason, fall
        // back to the notification helper so the user still gets feedback.
        showSuccess('Booking cancelled.');
        return;
    }

    // Replace any existing toast for a previous cancel so only the most
    // recent one is actionable.
    const existing = document.getElementById('undo-cancel-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'undo-cancel-toast';
    toast.className = 'success undo-cancel-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
        <span class="undo-cancel-toast-message">Booking cancelled.</span>
        <button type="button" class="btn-link undo-cancel-toast-btn" id="undo-cancel-btn" data-booking-id="${bookingId}">Undo</button>
    `;
    container.insertBefore(toast, container.firstChild);

    const dismiss = () => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    };
    const timer = setTimeout(dismiss, windowMs);

    const btn = toast.querySelector('#undo-cancel-btn');
    if (btn) {
        btn.addEventListener('click', async () => {
            clearTimeout(timer);
            btn.disabled = true;
            btn.textContent = 'Undoing…';
            try {
                await apiRequest(`/api/bookings/${bookingId}/undo-cancel`, {
                    method: 'POST',
                });
                dismiss();
                showSuccess('Booking restored.');
                loadBookings();
            } catch (error) {
                dismiss();
                showError('Could not undo cancellation: ' + error.message);
            }
        });
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

