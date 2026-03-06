// Desk Booking JavaScript

let selectedDeskIds = new Set(); // Track selected desk IDs for multi-select

document.addEventListener('DOMContentLoaded', () => {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
    
    const today = new Date().toISOString().split('T')[0];
    startDateInput.setAttribute('min', today);
    endDateInput.setAttribute('min', today);
    
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
}

function displayDesks(desks, startDate, endDate) {
    const container = document.getElementById('desks-container');
    
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
                        <button class="btn-secondary select-desk-btn" data-desk-id="${desk.id}" data-desk-number="${desk.deskNumber}">
                            ${isSelected ? 'Deselect' : 'Select'}
                        </button>
                        <button class="btn-primary book-desk-btn" data-desk-id="${desk.id}" data-desk-number="${desk.deskNumber}">Book</button>
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
            if (selectBtn) selectBtn.textContent = 'Deselect';
        } else {
            // Mark as not selected
            deskCard.classList.remove('selected');
            const indicator = deskCard.querySelector('.selection-indicator');
            if (indicator) indicator.remove();
            if (selectBtn) selectBtn.textContent = 'Select';
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
        if (selectBtn) selectBtn.textContent = 'Select';
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
    
    try {
        const response = await apiRequest('/api/bookings/bulk', {
            method: 'POST',
            body: {
                deskIds: deskIds,
                startDate: startDate,
                endDate: endDate,
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

async function bookDesk(deskId, deskNumber, startDate, endDate) {
    try {
        const response = await apiRequest('/api/bookings', {
            method: 'POST',
            body: {
                deskId: parseInt(deskId),
                startDate: startDate,
                endDate: endDate,
            },
        });
        
        showSuccess('Desk booked successfully!');
        
        setTimeout(() => {
            window.location.href = '/pages/bookings.html';
        }, 1500);
    } catch (error) {
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

function showError(message) {
    const messageDiv = document.getElementById('availability-message');
    messageDiv.innerHTML = `<div class="error">${message}</div>`;
}

function showSuccess(message) {
    const messageDiv = document.getElementById('availability-message');
    messageDiv.innerHTML = `<div class="success">${message}</div>`;
}

