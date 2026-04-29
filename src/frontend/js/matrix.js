// Booking Matrix JavaScript

const apiRequest = (endpoint, options) => {
    const impl = globalThis.apiRequest;
    if (typeof impl !== 'function') {
        throw new Error('apiRequest is not registered; load main.js before matrix.js.');
    }
    return impl(endpoint, options);
};

let currentMatrixData = null;

// Phase 31: matrix-region state. The region cycles between four states:
//   empty   — initial render before any Load Matrix click.
//   loading — after Load Matrix is pressed, while the request is in flight.
//   loaded  — successful response; #matrix-container is populated by
//             renderMatrix().
//   error   — failed response; the error block exposes a Retry button that
//             re-fires loadMatrix() with the current filters.
// After a successful load, subsequent reloads transition loading -> loaded
// or loading -> error and never return to the empty placeholder.
const MATRIX_EMPTY_HTML = `
    <div class="matrix-empty-state">
        <div class="matrix-state-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="4" x2="9" y2="20"></line>
                <line x1="15" y1="4" x2="15" y2="20"></line>
            </svg>
        </div>
        <h3 class="matrix-state-title">Select a date range to view bookings</h3>
        <p class="matrix-state-description">Pick a start and end date above, optionally narrow by user, desk, or parking space, then click <strong>Load Matrix</strong>.</p>
    </div>
`;

const MATRIX_LOADING_HTML = `
    <div class="matrix-loading-state" role="status" aria-live="polite">
        <div class="matrix-spinner" aria-hidden="true"></div>
        <h3 class="matrix-state-title">Loading matrix…</h3>
        <p class="matrix-state-description">Fetching bookings for the selected range.</p>
    </div>
`;

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildMatrixErrorHtml(message) {
    return `
        <div class="matrix-error-state" role="alert">
            <div class="matrix-state-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>
            <h3 class="matrix-state-title">Could not load the matrix</h3>
            <p class="matrix-error-message">${escapeHtml(message || 'Unknown error')}</p>
            <button id="matrix-retry-btn" class="btn-primary matrix-retry-btn" type="button">Retry</button>
        </div>
    `;
}

/**
 * Swap #matrix-region between the four lifecycle states. The "loaded"
 * state injects an empty #matrix-container that renderMatrix() then
 * fills in; this preserves backward compatibility with the grid renderer
 * which writes by id.
 *
 * @param {'empty'|'loading'|'loaded'|'error'} state
 * @param {{ message?: string }} [options]
 */
function setMatrixState(state, options = {}) {
    const region = document.getElementById('matrix-region');
    if (!region) return;
    region.setAttribute('data-state', state);
    if (state === 'empty') {
        region.innerHTML = MATRIX_EMPTY_HTML;
    } else if (state === 'loading') {
        region.innerHTML = MATRIX_LOADING_HTML;
    } else if (state === 'loaded') {
        region.innerHTML = '<div id="matrix-container" class="matrix-container"></div>';
    } else if (state === 'error') {
        region.innerHTML = buildMatrixErrorHtml(options.message);
        const retryBtn = document.getElementById('matrix-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => loadMatrix());
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication - matrix is admin only
    if (typeof requireAuth !== 'undefined' && !requireAuth()) {
        return;
    }

    // Check if user is admin
    if (typeof isAdmin === 'undefined' || !isAdmin()) {
        showError('Access denied. This page is for administrators only.');
        document.querySelector('.container').innerHTML = '<h2>Access Denied</h2><p>This page is for administrators only.</p>';
        return;
    }

    // Set default date range (next 2 weeks)
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

    document.getElementById('startDate').value = today.toISOString().split('T')[0];
    document.getElementById('endDate').value = twoWeeksLater.toISOString().split('T')[0];

    // Load initial data
    loadUsers();
    loadDesks();
    loadParkingSpaces();

    // Event listeners
    document.getElementById('loadMatrixBtn').addEventListener('click', loadMatrix);
    document.getElementById('exportMatrixBtn').addEventListener('click', exportMatrix);
    document.getElementById('viewType').addEventListener('change', () => {
        if (currentMatrixData) {
            renderMatrix(currentMatrixData);
        }
    });
});

async function loadUsers() {
    try {
        const users = await apiRequest('/api/auth/users');
        const userFilter = document.getElementById('userFilter');
        
        // Clear existing options except "All Users"
        userFilter.innerHTML = '<option value="">All Users</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.username} (${user.role})`;
            userFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadDesks() {
    try {
        const desks = await apiRequest('/api/admin/desks');
        const deskFilter = document.getElementById('deskFilter');
        
        deskFilter.innerHTML = '<option value="">All Desks</option>';
        
        desks.forEach(desk => {
            const option = document.createElement('option');
            option.value = desk.id;
            option.textContent = `Desk ${desk.deskNumber}`;
            deskFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load desks:', error);
    }
}

async function loadParkingSpaces() {
    try {
        const spaces = await apiRequest('/api/admin/parking-spaces');
        const parkingFilter = document.getElementById('parkingFilter');
        
        parkingFilter.innerHTML = '<option value="">All Spaces</option>';
        
        spaces.forEach(space => {
            const option = document.createElement('option');
            option.value = space.id;
            option.textContent = `Space ${space.spaceNumber}`;
            parkingFilter.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load parking spaces:', error);
    }
}

async function loadMatrix() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const viewType = document.getElementById('viewType').value;
    const userFilter = document.getElementById('userFilter');
    const deskFilter = document.getElementById('deskFilter');
    const parkingFilter = document.getElementById('parkingFilter');

    if (!startDate || !endDate) {
        // Date validation lives in the transient #matrix-message surface,
        // not the lifecycle state, so the empty / loaded state below is
        // unaffected when the user clicks Load with missing dates.
        showError('Please select both start and end dates');
        return;
    }

    const messageDiv = document.getElementById('matrix-message');
    if (messageDiv) {
        messageDiv.innerHTML = '';
    }
    // Phase 31: flip to loading state before the network call. Subsequent
    // reloads pass through loading -> loaded/error without dropping back
    // to the empty placeholder.
    setMatrixState('loading');

    try {
        // Build query parameters
        const params = new URLSearchParams({
            startDate,
            endDate,
            type: viewType,
        });

        const selectedUsers = Array.from(userFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v);
        if (selectedUsers.length > 0) {
            selectedUsers.forEach(userId => params.append('userIds', userId));
        }

        const selectedDesks = Array.from(deskFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v);
        if (selectedDesks.length > 0) {
            selectedDesks.forEach(deskId => params.append('deskIds', deskId));
        }

        const selectedParking = Array.from(parkingFilter.selectedOptions)
            .map(opt => opt.value)
            .filter(v => v);
        if (selectedParking.length > 0) {
            selectedParking.forEach(spaceId => params.append('parkingSpaceIds', spaceId));
        }

        const matrixData = await apiRequest(`/api/matrix/bookings?${params.toString()}`);
        currentMatrixData = matrixData;

        // Phase 31: transition to loaded; setMatrixState injects a fresh
        // #matrix-container that renderMatrix() then populates.
        setMatrixState('loaded');
        renderMatrix(matrixData);
    } catch (error) {
        console.error('Failed to load matrix:', error);
        // Phase 31: transition to the error state. The Retry button inside
        // re-fires loadMatrix() with the current filter values.
        setMatrixState('error', { message: error && error.message ? error.message : 'Unknown error' });
    }
}

function renderMatrix(matrixData) {
    const container = document.getElementById('matrix-container');
    const viewType = document.getElementById('viewType').value;

    if (!matrixData || !matrixData.users || matrixData.users.length === 0) {
        container.innerHTML = '<p>No data available for the selected date range and filters.</p>';
        return;
    }

    const table = document.createElement('table');
    table.className = 'matrix-table';

    // Create header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // User column header
    const userHeader = document.createElement('th');
    userHeader.className = 'user-column';
    userHeader.textContent = 'User';
    headerRow.appendChild(userHeader);

    // Date column headers
    matrixData.dateRange.forEach(date => {
        const dateHeader = document.createElement('th');
        dateHeader.className = 'date-header';
        const dateObj = new Date(date);
        dateHeader.textContent = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateHeader.title = date;
        headerRow.appendChild(dateHeader);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement('tbody');

    matrixData.users.forEach(user => {
        const row = document.createElement('tr');
        
        // User name cell
        const userCell = document.createElement('td');
        userCell.className = 'user-column';
        userCell.textContent = user.username;
        if (user.role === 'admin') {
            userCell.textContent += ' (Admin)';
        }
        row.appendChild(userCell);

        // Date cells
        matrixData.dateRange.forEach(date => {
            const cell = document.createElement('td');
            cell.className = 'matrix-cell';
            
            const cellData = matrixData.data[user.id] && matrixData.data[user.id][date]
                ? matrixData.data[user.id][date]
                : { deskBookings: [], parkingReservations: [] };

            // Show desk bookings
            if ((viewType === 'desks' || viewType === 'combined') && cellData.deskBookings.length > 0) {
                cellData.deskBookings.forEach(booking => {
                    const indicator = document.createElement('span');
                    indicator.className = 'booking-indicator booking-desk';
                    indicator.textContent = `D${booking.deskNumber}`;
                    indicator.title = `Desk ${booking.deskNumber} (${booking.startDate} to ${booking.endDate})`;
                    cell.appendChild(indicator);
                });
            }

            // Show parking reservations
            if ((viewType === 'parking' || viewType === 'combined') && cellData.parkingReservations.length > 0) {
                cellData.parkingReservations.forEach(reservation => {
                    const indicator = document.createElement('span');
                    indicator.className = `booking-indicator booking-parking ${reservation.timePeriod}`;
                    const periodLabel = reservation.timePeriod === 'morning' ? 'M' : 
                                      reservation.timePeriod === 'afternoon' ? 'A' : 'FD';
                    indicator.textContent = `P${reservation.spaceNumber} ${periodLabel}`;
                    indicator.title = `Parking ${reservation.spaceNumber} - ${reservation.timePeriod} (${reservation.reservationDate})`;
                    cell.appendChild(indicator);
                });
            }

            // Add hover tooltip
            if (cellData.deskBookings.length > 0 || cellData.parkingReservations.length > 0) {
                cell.classList.add('has-booking');
                cell.addEventListener('mouseenter', (e) => showTooltip(e, cellData, date, user));
                cell.addEventListener('mouseleave', hideTooltip);
            }

            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.innerHTML = '';
    container.appendChild(table);
}

function showTooltip(event, cellData, date, user) {
    const tooltip = document.getElementById('matrix-tooltip');
    let content = `<strong>${user.username} - ${date}</strong><br>`;

    if (cellData.deskBookings.length > 0) {
        content += '<br><strong>Desk Bookings:</strong><br>';
        cellData.deskBookings.forEach(booking => {
            content += `• Desk ${booking.deskNumber} (${booking.startDate} to ${booking.endDate})<br>`;
        });
    }

    if (cellData.parkingReservations.length > 0) {
        content += '<br><strong>Parking Reservations:</strong><br>';
        cellData.parkingReservations.forEach(reservation => {
            const periodLabel = reservation.timePeriod === 'morning' ? 'Morning' :
                              reservation.timePeriod === 'afternoon' ? 'Afternoon' : 'Full Day';
            content += `• Space ${reservation.spaceNumber} - ${periodLabel}<br>`;
        });
    }

    tooltip.innerHTML = content;
    tooltip.classList.add('show');

    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = (rect.left + rect.width / 2) + 'px';
    tooltip.style.top = (rect.bottom + 10) + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('matrix-tooltip');
    tooltip.classList.remove('show');
}

function exportMatrix() {
    if (!currentMatrixData) {
        showError('Please load matrix data first');
        return;
    }

    // Generate CSV
    let csv = 'User,Date,Desk Bookings,Parking Reservations\n';

    currentMatrixData.users.forEach(user => {
        currentMatrixData.dateRange.forEach(date => {
            const cellData = currentMatrixData.data[user.id] && currentMatrixData.data[user.id][date]
                ? currentMatrixData.data[user.id][date]
                : { deskBookings: [], parkingReservations: [] };

            const deskBookings = cellData.deskBookings.map(b => `Desk ${b.deskNumber}`).join('; ');
            const parkingReservations = cellData.parkingReservations.map(r => 
                `Space ${r.spaceNumber} (${r.timePeriod})`
            ).join('; ');

            if (deskBookings || parkingReservations) {
                csv += `"${user.username}","${date}","${deskBookings}","${parkingReservations}"\n`;
            }
        });
    });

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booking-matrix-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showSuccess('Matrix exported successfully');
}

function showError(message) {
    const messageDiv = document.getElementById('matrix-message');
    messageDiv.innerHTML = `<div class="error">${message}</div>`;
}

function showSuccess(message) {
    const messageDiv = document.getElementById('matrix-message');
    messageDiv.innerHTML = `<div class="success">${message}</div>`;
}

// Phase 31: expose state surface on window for test harnesses (mirroring
// the desk-booking.js / parking.js pattern). Production code does not
// rely on these globals; they're test-only entry points.
if (typeof window !== 'undefined') {
    window.setMatrixState = setMatrixState;
    window.loadMatrix = loadMatrix;
    window.renderMatrix = renderMatrix;
}

