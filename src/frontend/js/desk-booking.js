// Desk Booking JavaScript

const apiRequest = (endpoint, options) => {
    const impl = globalThis.apiRequest;
    if (typeof impl !== 'function') {
        throw new Error('apiRequest is not registered; load main.js before desk-booking.js.');
    }
    return impl(endpoint, options);
};

let selectedDeskIds = new Set(); // Track selected desk IDs for multi-select

// Phase 23e: cached map configuration so we don't re-fetch on every
// availability check. Refreshed on page load.
let deskMapConfig = null;
// Last-known available desks list, indexed by desk id, used when (re-)rendering
// the map after an availability check.
let lastAvailableDesks = [];
let lastDateRange = { start: null, end: null };

document.addEventListener('DOMContentLoaded', async () => {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');

    const today = new Date().toISOString().split('T')[0];
    startDateInput.setAttribute('min', today);
    endDateInput.setAttribute('min', today);

    // Phase 23e: pull the desk map config once. The renderer is loaded
    // via <script src="/js/map-renderer.js"> on this page.
    const mapContainer = document.getElementById('desk-map-container');
    if (mapContainer && globalThis.MapRenderer) {
        try {
            deskMapConfig = await globalThis.MapRenderer.load('desk');
            renderDeskMap();
            // Wire map -> list. A click on a desk marker scrolls to the
            // matching desk card and toggles its Select state. Clicks on
            // landmarks are blocked by CSS pointer-events.
            mapContainer.addEventListener('map:resource-click', (event) => {
                const id = event.detail && event.detail.resourceId;
                onMapDeskClick(id);
            });
        } catch (_err) {
            // Renderer's load() already swallows errors; nothing to do.
        }
    }
    
    startDateInput.addEventListener('change', () => {
        endDateInput.setAttribute('min', startDateInput.value);
        if (endDateInput.value && endDateInput.value < startDateInput.value) {
            endDateInput.value = startDateInput.value;
        }
        // Clear selection when dates change
        selectedDeskIds.clear();
        // Auto-check availability when dates change if both dates are selected
        if (startDateInput.value && endDateInput.value) {
            checkAvailability();
        }
    });
    
    endDateInput.addEventListener('change', () => {
        // Clear selection when dates change
        selectedDeskIds.clear();
        // Auto-check availability when end date changes if both dates are selected
        if (startDateInput.value && endDateInput.value) {
            checkAvailability();
        }
    });
    
    checkAvailabilityBtn.addEventListener('click', checkAvailability);
});

async function checkAvailability() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const messageDiv = document.getElementById('availability-message');
    const desksContainer = document.getElementById('desks-container');
    
    if (!startDate || !endDate) {
        showError('Please select both start and end dates');
        return;
    }
    
    if (startDate > endDate) {
        showError('Start date must be before or equal to end date');
        return;
    }
    
    messageDiv.innerHTML = '<p>Checking availability...</p>';
    desksContainer.innerHTML = '';
    
    try {
        const response = await apiRequest(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`);
        
        // Handle both old format (array) and new format (object with counts)
        const availableDesks = response.availableDesks || response;
        const remainingDesks = response.remainingDesks !== undefined ? response.remainingDesks : availableDesks.length;
        const totalDesks = response.totalDesks !== undefined ? response.totalDesks : null;
        
        if (availableDesks.length === 0) {
            const remainingMessage = totalDesks !== null 
                ? `<div class="error"><strong>No desks available</strong> for the selected date range (${totalDesks} total desks, all booked). Please try different dates.</div>`
                : '<div class="error">No desks available for the selected date range. Please try different dates.</div>';
            messageDiv.innerHTML = remainingMessage;
            desksContainer.innerHTML = '';
        } else {
            const remainingInfo = totalDesks !== null 
                ? `<div class="availability-counter"><strong>${remainingDesks} desk${remainingDesks !== 1 ? 's' : ''} remaining</strong> out of ${totalDesks} total</div>`
                : `<div class="availability-counter"><strong>${remainingDesks} desk${remainingDesks !== 1 ? 's' : ''} available</strong></div>`;
            messageDiv.innerHTML = `<div class="success">Found ${availableDesks.length} available desk(s) for the selected dates.</div>${remainingInfo}`;
            displayDesks(availableDesks, startDate, endDate);
        }
    } catch (error) {
        showError('Failed to check availability: ' + error.message);
        desksContainer.innerHTML = '';
    }

    // Phase 27c: refresh the per-day fob availability hint after each
    // Check Availability click. Awaiting here would block the desk
    // list render; we let it run in the background and silently absorb
    // any error (the hint is informational only).
    updateFobAvailabilityHint(startDate, endDate).catch(() => {});
}

function displayDesks(desks, startDate, endDate) {
    const container = document.getElementById('desks-container');

    // Phase 23e: keep the most recent availability + dates so the map can
    // re-render whenever selection changes.
    lastAvailableDesks = desks;
    lastDateRange = { start: startDate, end: endDate };
    renderDeskMap();

    if (desks.length === 0) {
        container.innerHTML = '<p>No desks available.</p>';
        updateSelectionUI();
        return;
    }
    
    const desksHTML = `
        <h3>Available Desks</h3>
        <div class="selection-controls" id="selection-controls" style="display: none;">
            <div class="selection-info">
                <span id="selection-count">0 desks selected</span>
                <button class="btn-secondary" id="clear-selection-btn">Clear Selection</button>
            </div>
            <button class="btn-primary" id="book-selected-btn" disabled>Book Selected Desks</button>
        </div>
        <div class="desks-grid">
            ${desks.map(desk => {
                const isSelected = selectedDeskIds.has(desk.id.toString());
                return `
                <div class="desk-card ${isSelected ? 'selected' : ''}" data-desk-id="${desk.id}">
                    ${isSelected ? '<div class="selection-indicator">✓ Selected</div>' : ''}
                    <h4><strong>Desk ${desk.deskNumber}</strong></h4>
                    ${desk.location ? `<p><strong>Location:</strong> ${desk.location}</p>` : ''}
                    ${desk.description ? `<p>${desk.description}</p>` : ''}
                    <div class="desk-card-buttons">
                        <button type="button" class="btn-secondary btn-card-action select-desk-btn${isSelected ? ' is-selected' : ''}" aria-pressed="${isSelected ? 'true' : 'false'}" data-desk-id="${desk.id}" data-desk-number="${desk.deskNumber}">
                            ${isSelected ? 'Selected' : 'Select'}
                        </button>
                        <button type="button" class="btn-primary btn-card-action book-desk-btn"${isSelected ? ' hidden' : ''} data-desk-id="${desk.id}" data-desk-number="${desk.deskNumber}">Book</button>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
    
    container.innerHTML = desksHTML;
    
    // Add event listeners for Select buttons
    document.querySelectorAll('.select-desk-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const deskId = btn.getAttribute('data-desk-id');
            toggleDeskSelection(deskId, startDate, endDate);
        });
    });
    
    // Add event listeners for Book buttons (single booking)
    document.querySelectorAll('.book-desk-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const deskId = btn.getAttribute('data-desk-id');
            const deskNumber = btn.getAttribute('data-desk-number');
            bookDesk(deskId, deskNumber, startDate, endDate);
        });
    });
    
    // Add event listener for Book Selected button
    const bookSelectedBtn = document.getElementById('book-selected-btn');
    if (bookSelectedBtn) {
        bookSelectedBtn.addEventListener('click', () => {
            bookSelectedDesks(startDate, endDate);
        });
    }
    
    // Add event listener for Clear Selection button
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearSelection);
    }
    
    updateSelectionUI();
}

function toggleDeskSelection(deskId, startDate, endDate) {
    const deskIdStr = deskId.toString();
    const wasSelected = selectedDeskIds.has(deskIdStr);
    
    if (wasSelected) {
        selectedDeskIds.delete(deskIdStr);
    } else {
        selectedDeskIds.add(deskIdStr);
    }
    
    // Update only the specific card without re-rendering everything
    const deskCard = document.querySelector(`.desk-card[data-desk-id="${deskId}"]`);
    if (deskCard) {
        const selectBtn = deskCard.querySelector('.select-desk-btn');
        const bookBtn = deskCard.querySelector('.book-desk-btn');
        
        if (selectedDeskIds.has(deskIdStr)) {
            // Mark as selected
            deskCard.classList.add('selected');
            if (!deskCard.querySelector('.selection-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'selection-indicator';
                indicator.textContent = '✓ Selected';
                deskCard.insertBefore(indicator, deskCard.querySelector('h4'));
            }
            // Phase 28: Select button is a true toggle. When selected, label
            // reads "Selected", aria-pressed is true, and the .is-selected
            // class flips it to the active style.
            if (selectBtn) {
                selectBtn.textContent = 'Selected';
                selectBtn.setAttribute('aria-pressed', 'true');
                selectBtn.classList.add('is-selected');
            }
            // Phase 23.12 / spec section 19: hide the per-card Book button when
            // the desk is in the multi-select selection; Book Selected takes
            // its place for selected items.
            if (bookBtn) bookBtn.hidden = true;
        } else {
            // Mark as not selected
            deskCard.classList.remove('selected');
            const indicator = deskCard.querySelector('.selection-indicator');
            if (indicator) indicator.remove();
            if (selectBtn) {
                selectBtn.textContent = 'Select';
                selectBtn.setAttribute('aria-pressed', 'false');
                selectBtn.classList.remove('is-selected');
            }
            if (bookBtn) bookBtn.hidden = false;
        }
    }
    
    // Update selection UI (count, buttons)
    updateSelectionUI();
}

function clearSelection() {
    selectedDeskIds.clear();
    
    // Update all desk cards without re-rendering
    document.querySelectorAll('.desk-card').forEach(card => {
        card.classList.remove('selected');
        const indicator = card.querySelector('.selection-indicator');
        if (indicator) indicator.remove();
        const selectBtn = card.querySelector('.select-desk-btn');
        if (selectBtn) {
            // Phase 28: keep the Select toggle in sync — label, aria-pressed,
            // and the .is-selected active style.
            selectBtn.textContent = 'Select';
            selectBtn.setAttribute('aria-pressed', 'false');
            selectBtn.classList.remove('is-selected');
        }
        // Phase 23.12: un-hide the per-card Book button when selection is cleared.
        const bookBtn = card.querySelector('.book-desk-btn');
        if (bookBtn) bookBtn.hidden = false;
    });
    
    // Update selection UI
    updateSelectionUI();
}

function updateSelectionUI() {
    const selectionControls = document.getElementById('selection-controls');
    const selectionCount = document.getElementById('selection-count');
    const bookSelectedBtn = document.getElementById('book-selected-btn');
    
    const count = selectedDeskIds.size;
    
    if (selectionControls) {
        selectionControls.style.display = count > 0 ? 'block' : 'none';
    }
    
    if (selectionCount) {
        selectionCount.textContent = `${count} desk${count !== 1 ? 's' : ''} selected`;
    }
    
    if (bookSelectedBtn) {
        bookSelectedBtn.disabled = count === 0;
    }
}

async function bookSelectedDesks(startDate, endDate) {
    if (selectedDeskIds.size === 0) {
        showError('Please select at least one desk to book');
        return;
    }

    const deskIds = Array.from(selectedDeskIds).map(id => parseInt(id));
    const fobRequested = readFobRequestedFlag();

    try {
        const response = await apiRequest('/api/bookings/bulk', {
            method: 'POST',
            body: {
                deskIds: deskIds,
                startDate: startDate,
                endDate: endDate,
                fobRequested,
            },
        });
        
        const successCount = response.successful || deskIds.length;
        const failedCount = response.failed ? response.failed.length : 0;
        
        if (failedCount === 0) {
            showSuccess(`Successfully booked ${successCount} desk${successCount !== 1 ? 's' : ''}!`);
        } else {
            showError(`Booked ${successCount} desk${successCount !== 1 ? 's' : ''}, but ${failedCount} failed. ${response.errors ? response.errors.join(' ') : ''}`);
        }
        
        // Clear selection after booking
        selectedDeskIds.clear();
        
        setTimeout(() => {
            window.location.href = '/pages/bookings.html';
        }, 1500);
    } catch (error) {
        if (error.message.includes('already have a desk booking') || error.message.includes('overlap')) {
            showError(error.message || 'Some desks could not be booked due to overlapping dates.');
        } else if (error.message.includes('already booked by another user')) {
            showError(error.message || 'Some desks are already booked by other users. Please check availability again.');
            checkAvailability();
        } else if (error.message.includes('not available') || error.message.includes('unavailable')) {
            showError('Some desks are no longer available. Please check availability again.');
            checkAvailability();
        } else {
            showError('Failed to book selected desks: ' + error.message);
        }
    }
}

/**
 * Phase 27c: read the "Fob needed" checkbox state from the booking
 * form. Defaults to false when the checkbox is missing (e.g. tests
 * that mount only part of the form).
 */
function readFobRequestedFlag() {
    const cb = document.getElementById('fobRequested');
    return !!(cb && cb.checked);
}

async function bookDesk(deskId, deskNumber, startDate, endDate) {
    const fobRequested = readFobRequestedFlag();
    try {
        const response = await apiRequest('/api/bookings', {
            method: 'POST',
            body: {
                deskId: parseInt(deskId),
                startDate: startDate,
                endDate: endDate,
                fobRequested,
            },
        });

        showSuccess(fobRequested
            ? 'Desk booked successfully (with fob).'
            : 'Desk booked successfully!');

        setTimeout(() => {
            window.location.href = '/pages/bookings.html';
        }, 1500);
    } catch (error) {
        // Phase 27c: fob inventory rejection. The server returns
        // `error.code === 'FOB_UNAVAILABLE'` and `offendingDates`. The
        // apiRequest helper surfaces those on the thrown error so we
        // can render a date-aware message and refresh the inline hint
        // without forcing the user to click Check Availability again.
        if (error && (error.code === 'FOB_UNAVAILABLE' || /FOB_UNAVAILABLE/.test(error.message || ''))) {
            const dates = (error.offendingDates && error.offendingDates.length)
                ? error.offendingDates.join(', ')
                : 'one or more days in the selected range';
            showError(`Fob unavailable on ${dates}. Try unchecking "Fob needed" or pick different dates.`);
            // Reload the per-day availability hint so the user sees the
            // exhausted day(s) immediately.
            updateFobAvailabilityHint(startDate, endDate).catch(() => {});
            return;
        }
        if (error.message.includes('already have a desk booking') || error.message.includes('overlap')) {
            showError(error.message || 'You already have a desk booking for overlapping dates. You cannot book multiple desks for overlapping periods.');
        } else if (error.message.includes('already booked by another user')) {
            showError(error.message || 'This desk is already booked by another user for the selected dates. Please check availability again.');
            checkAvailability();
        } else if (error.message.includes('not available') || error.message.includes('unavailable')) {
            showError('This desk is no longer available for the selected dates. Please check availability again.');
            checkAvailability();
        } else {
            showError('Failed to book desk: ' + error.message);
        }
    }
}

/**
 * Phase 27c: render an inline per-day fob availability hint below the
 * "Check Availability" button. We DON'T pre-flight an inventory call
 * for unauthenticated visitors or before a date range has been chosen
 * — only after Check Availability so the call is on-demand.
 *
 * The endpoint we use here, `/api/admin/fob/calendar`, is admin-only
 * (Office Administrator + Administrator). Regular users get a 403 and
 * the hint is suppressed silently — they still see the booking-time
 * rejection if the fob is exhausted.
 */
async function updateFobAvailabilityHint(startDate, endDate) {
    const hint = document.getElementById('fob-availability-hint');
    if (!hint) return;
    if (!startDate || !endDate) {
        hint.innerHTML = '';
        return;
    }
    try {
        const data = await apiRequest(
            `/api/admin/fob/calendar?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
        );
        const days = (data && Array.isArray(data.days)) ? data.days : [];
        if (!days.length) {
            hint.innerHTML = '';
            return;
        }
        const allUnconfigured = days.every((d) => d.configured === null || d.configured === undefined);
        if (allUnconfigured) {
            hint.innerHTML = '<p class="help-text">Fob inventory is not configured for this range — fob requests will be tracked but not blocked.</p>';
            return;
        }
        const exhausted = days.filter((d) => d.configured !== null && d.available === 0).map((d) => d.date);
        const lines = days.map((d) => {
            if (d.configured === null || d.configured === undefined) {
                return `<li>${escapeHtml(d.date)}: <span class="text-muted">no inventory configured</span></li>`;
            }
            const cls = d.available === 0 ? 'fob-day-exhausted' : '';
            return `<li class="${cls}">${escapeHtml(d.date)}: ${escapeHtml(String(d.available))} of ${escapeHtml(String(d.configured))} fob(s) remaining</li>`;
        }).join('');
        const exhaustedNote = exhausted.length
            ? `<p class="help-text fob-availability-exhausted">No fobs remaining on ${escapeHtml(exhausted.join(', '))}.</p>`
            : '';
        hint.innerHTML = `
            <div class="fob-availability-hint card">
                <strong>Fob availability for the selected range:</strong>
                <ul>${lines}</ul>
                ${exhaustedNote}
            </div>
        `;
    } catch (error) {
        // 403 for non-admin callers is expected — clear the hint so the
        // page doesn't show a stale value. Other errors are silenced
        // because the inline hint is informational only.
        hint.innerHTML = '';
    }
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

if (typeof window !== 'undefined') {
    window.checkAvailability = checkAvailability;
    window.bookDesk = bookDesk;
    window.displayDesks = displayDesks;
    window.bookSelectedDesks = bookSelectedDesks;
    window.selectedDeskIds = selectedDeskIds;
    // Phase 27c surface for tests.
    window.readFobRequestedFlag = readFobRequestedFlag;
    window.updateFobAvailabilityHint = updateFobAvailabilityHint;
}

function showError(message) {
    const messageDiv = document.getElementById('availability-message');
    messageDiv.innerHTML = `<div class="error">${message}</div>`;
}

function showSuccess(message) {
    const messageDiv = document.getElementById('availability-message');
    messageDiv.innerHTML = `<div class="success">${message}</div>`;
}

// ---------------------------------------------------------------------------
// Phase 23e: floor plan map integration on the desk booking page.
// ---------------------------------------------------------------------------

/**
 * Re-render the map using the current map config + the most recent
 * availability / selection state. Markers correspond to desks the
 * server returned as available; the placement coords come from the map
 * config; selection visually mirrors the list's selection state.
 */
function renderDeskMap() {
    const container = document.getElementById('desk-map-container');
    if (!container || !globalThis.MapRenderer) return;

    // Build the resource list the renderer wants. Each entry is the desk
    // joined with its placement coordinates (from the map config). Desks
    // without coordinates are skipped — there's nothing for the renderer
    // to draw at "no position".
    const placedById = new Map();
    if (deskMapConfig && Array.isArray(deskMapConfig.resources)) {
        deskMapConfig.resources.forEach((c) => placedById.set(String(c.resourceId), c));
    }
    const resources = lastAvailableDesks.map((desk) => {
        const placement = placedById.get(String(desk.id));
        if (!placement) return null;
        return {
            id: desk.id,
            number: desk.deskNumber,
            x: placement.x,
            y: placement.y,
        };
    }).filter(Boolean);

    globalThis.MapRenderer.render(container, deskMapConfig, {
        resources,
        selectedIds: selectedDeskIds,
        resourceLabelPrefix: 'Desk',
    });
}

/**
 * Handle a click on a desk marker on the map. We mirror the list's
 * Select / Deselect behavior: clicking toggles the multi-select state for
 * that desk, identical to clicking its Select button. Items that aren't
 * in the currently-loaded availability are ignored (e.g. desks placed on
 * the map that aren't available for the chosen dates).
 */
function onMapDeskClick(deskId) {
    if (deskId === undefined || deskId === null) return;
    const id = String(deskId);
    const stillAvailable = lastAvailableDesks.find((d) => String(d.id) === id);
    if (!stillAvailable) return;
    if (!lastDateRange.start || !lastDateRange.end) return;

    if (typeof toggleDeskSelection === 'function') {
        toggleDeskSelection(id, lastDateRange.start, lastDateRange.end);
        renderDeskMap();
    }
}

