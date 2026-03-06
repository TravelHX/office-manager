// Parking Reservation JavaScript

let selectedParkingSpaceIds = new Set(); // Track selected parking space IDs for multi-select

document.addEventListener('DOMContentLoaded', () => {
    const reservationDateInput = document.getElementById('reservationDate');
    const timePeriodSelect = document.getElementById('timePeriod');
    const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
    
    const today = new Date().toISOString().split('T')[0];
    reservationDateInput.setAttribute('min', today);
    
    checkAvailabilityBtn.addEventListener('click', checkAvailability);
    
    // Auto-check availability when date or time period changes
    reservationDateInput.addEventListener('change', () => {
        // Clear selection when date or time period changes
        selectedParkingSpaceIds.clear();
        if (reservationDateInput.value && timePeriodSelect.value) {
            checkAvailability();
        }
    });
    
    timePeriodSelect.addEventListener('change', () => {
        // Clear selection when date or time period changes
        selectedParkingSpaceIds.clear();
        if (reservationDateInput.value && timePeriodSelect.value) {
            checkAvailability();
        }
    });
});

async function checkAvailability() {
    const reservationDate = document.getElementById('reservationDate').value;
    const timePeriod = document.getElementById('timePeriod').value;
    const messageDiv = document.getElementById('availability-message');
    const spacesContainer = document.getElementById('parking-spaces-container');
    
    if (!reservationDate || !timePeriod) {
        showError('Please select both date and time period');
        return;
    }
    
    messageDiv.innerHTML = '<p>Checking availability...</p>';
    spacesContainer.innerHTML = '';
    
    try {
        const response = await apiRequest(`/api/parking-spaces/available?reservationDate=${reservationDate}&timePeriod=${timePeriod}`);
        
        // Handle both old format (array) and new format (object with availability info)
        const availableSpaces = response.availableSpaces || response;
        const remainingSpaces = response.remainingSpaces !== undefined ? response.remainingSpaces : availableSpaces.length;
        const totalSpaces = response.totalSpaces !== undefined ? response.totalSpaces : null;
        const timePeriodLabel = timePeriod === 'morning' ? 'Morning' : timePeriod === 'afternoon' ? 'Afternoon' : 'Full Day';
        
        if (availableSpaces.length === 0) {
            const remainingMessage = totalSpaces !== null 
                ? `<div class="error"><strong>No parking spaces available</strong> for ${reservationDate} (${timePeriodLabel}) - ${totalSpaces} total spaces, all booked. Please try different options.</div>`
                : `<div class="error">No parking spaces available for the selected date and time period. Please try different options.</div>`;
            messageDiv.innerHTML = remainingMessage;
            spacesContainer.innerHTML = '';
        } else {
            const remainingInfo = totalSpaces !== null 
                ? `<div class="availability-counter"><strong>${remainingSpaces} parking space${remainingSpaces !== 1 ? 's' : ''} remaining</strong> out of ${totalSpaces} total</div>`
                : `<div class="availability-counter"><strong>${remainingSpaces} parking space${remainingSpaces !== 1 ? 's' : ''} available</strong></div>`;
            messageDiv.innerHTML = `<div class="success">Found ${availableSpaces.length} available parking space(s) for ${reservationDate} (${timePeriodLabel}).</div>${remainingInfo}`;
            displayParkingSpaces(availableSpaces, reservationDate, timePeriod);
        }
    } catch (error) {
        showError('Failed to check availability: ' + error.message);
        spacesContainer.innerHTML = '';
    }
}

function displayParkingSpaces(spaces, reservationDate, timePeriod) {
    const container = document.getElementById('parking-spaces-container');
    
    if (spaces.length === 0) {
        container.innerHTML = '<p>No parking spaces available.</p>';
        updateParkingSelectionUI();
        return;
    }
    
    const timePeriodLabel = timePeriod === 'morning' ? 'Morning' : timePeriod === 'afternoon' ? 'Afternoon' : 'Full Day';
    
    const spacesHTML = `
        <h3>Available Parking Spaces</h3>
        <div class="selection-controls" id="parking-selection-controls" style="display: none;">
            <div class="selection-info">
                <span id="parking-selection-count">0 spaces selected</span>
                <button class="btn-secondary" id="clear-parking-selection-btn">Clear Selection</button>
            </div>
            <button class="btn-primary" id="reserve-selected-btn" disabled>Reserve Selected</button>
        </div>
        <div class="desks-grid">
            ${spaces.map(space => {
                const isSelected = selectedParkingSpaceIds.has(space.id.toString());
                return `
                <div class="desk-card ${isSelected ? 'selected' : ''}" data-space-id="${space.id}">
                    ${isSelected ? '<div class="selection-indicator">✓ Selected</div>' : ''}
                    <h4><strong>Space ${space.spaceNumber}</strong></h4>
                    ${space.location ? `<p><strong>Location:</strong> ${space.location}</p>` : ''}
                    ${space.description ? `<p>${space.description}</p>` : ''}
                    <div class="desk-card-buttons">
                        <button class="btn-secondary select-space-btn" data-space-id="${space.id}" data-space-number="${space.spaceNumber}">
                            ${isSelected ? 'Deselect' : 'Select'}
                        </button>
                        <button class="btn-primary book-space-btn" data-space-id="${space.id}" data-space-number="${space.spaceNumber}">Reserve</button>
                    </div>
                </div>
            `;
            }).join('')}
        </div>
    `;
    
    container.innerHTML = spacesHTML;
    
    // Add event listeners for Select buttons
    document.querySelectorAll('.select-space-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const spaceId = btn.getAttribute('data-space-id');
            toggleParkingSpaceSelection(spaceId, reservationDate, timePeriod);
        });
    });
    
    // Add event listeners for Reserve buttons (single reservation)
    document.querySelectorAll('.book-space-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const spaceId = btn.getAttribute('data-space-id');
            const spaceNumber = btn.getAttribute('data-space-number');
            reserveParkingSpace(spaceId, spaceNumber, reservationDate, timePeriod);
        });
    });
    
    // Add event listener for Reserve Selected button
    const reserveSelectedBtn = document.getElementById('reserve-selected-btn');
    if (reserveSelectedBtn) {
        reserveSelectedBtn.addEventListener('click', () => {
            reserveSelectedParkingSpaces(reservationDate, timePeriod);
        });
    }
    
    // Add event listener for Clear Selection button
    const clearSelectionBtn = document.getElementById('clear-parking-selection-btn');
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearParkingSelection);
    }
    
    updateParkingSelectionUI();
}

function toggleParkingSpaceSelection(spaceId, reservationDate, timePeriod) {
    const spaceIdStr = spaceId.toString();
    const wasSelected = selectedParkingSpaceIds.has(spaceIdStr);
    
    if (wasSelected) {
        selectedParkingSpaceIds.delete(spaceIdStr);
    } else {
        selectedParkingSpaceIds.add(spaceIdStr);
    }
    
    // Update only the specific card without re-rendering everything
    const spaceCard = document.querySelector(`.desk-card[data-space-id="${spaceId}"]`);
    if (spaceCard) {
        const selectBtn = spaceCard.querySelector('.select-space-btn');
        const reserveBtn = spaceCard.querySelector('.book-space-btn');
        
        if (selectedParkingSpaceIds.has(spaceIdStr)) {
            // Mark as selected
            spaceCard.classList.add('selected');
            if (!spaceCard.querySelector('.selection-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'selection-indicator';
                indicator.textContent = '✓ Selected';
                spaceCard.insertBefore(indicator, spaceCard.querySelector('h4'));
            }
            if (selectBtn) selectBtn.textContent = 'Deselect';
        } else {
            // Mark as not selected
            spaceCard.classList.remove('selected');
            const indicator = spaceCard.querySelector('.selection-indicator');
            if (indicator) indicator.remove();
            if (selectBtn) selectBtn.textContent = 'Select';
        }
    }
    
    // Update selection UI (count, buttons)
    updateParkingSelectionUI();
}

function clearParkingSelection() {
    selectedParkingSpaceIds.clear();
    
    // Update all parking space cards without re-rendering
    document.querySelectorAll('.desk-card[data-space-id]').forEach(card => {
        card.classList.remove('selected');
        const indicator = card.querySelector('.selection-indicator');
        if (indicator) indicator.remove();
        const selectBtn = card.querySelector('.select-space-btn');
        if (selectBtn) selectBtn.textContent = 'Select';
    });
    
    // Update selection UI
    updateParkingSelectionUI();
}

function updateParkingSelectionUI() {
    const selectionControls = document.getElementById('parking-selection-controls');
    const selectionCount = document.getElementById('parking-selection-count');
    const reserveSelectedBtn = document.getElementById('reserve-selected-btn');
    
    const count = selectedParkingSpaceIds.size;
    
    if (selectionControls) {
        selectionControls.style.display = count > 0 ? 'block' : 'none';
    }
    
    if (selectionCount) {
        selectionCount.textContent = `${count} space${count !== 1 ? 's' : ''} selected`;
    }
    
    if (reserveSelectedBtn) {
        reserveSelectedBtn.disabled = count === 0;
    }
}

async function reserveSelectedParkingSpaces(reservationDate, timePeriod) {
    if (selectedParkingSpaceIds.size === 0) {
        showError('Please select at least one parking space to reserve');
        return;
    }
    
    const spaceIds = Array.from(selectedParkingSpaceIds).map(id => parseInt(id));
    
    try {
        const response = await apiRequest('/api/parking-reservations/bulk', {
            method: 'POST',
            body: {
                parkingSpaceIds: spaceIds,
                reservationDate: reservationDate,
                timePeriod: timePeriod,
            },
        });
        
        const successCount = response.successful || spaceIds.length;
        const failedCount = response.failed ? response.failed.length : 0;
        
        if (failedCount === 0) {
            showSuccess(`Successfully reserved ${successCount} parking space${successCount !== 1 ? 's' : ''}!`);
        } else {
            showError(`Reserved ${successCount} parking space${successCount !== 1 ? 's' : ''}, but ${failedCount} failed. ${response.errors ? response.errors.join(' ') : ''}`);
        }
        
        // Clear selection after reservation
        selectedParkingSpaceIds.clear();
        
        setTimeout(() => {
            window.location.href = '/pages/bookings.html';
        }, 1500);
    } catch (error) {
        if (error.message.includes('already have a parking reservation') || error.message.includes('overlapping')) {
            showError(error.message || 'Some parking spaces could not be reserved due to overlapping periods.');
        } else if (error.message.includes('already reserved by another user')) {
            showError(error.message || 'Some parking spaces are already reserved by other users. Please check availability again.');
            checkAvailability();
        } else if (error.message.includes('not available') || error.message.includes('unavailable')) {
            showError('Some parking spaces are no longer available. Please check availability again.');
            checkAvailability();
        } else {
            showError('Failed to reserve selected parking spaces: ' + error.message);
        }
    }
}

async function reserveParkingSpace(spaceId, spaceNumber, reservationDate, timePeriod) {
    try {
        const response = await apiRequest('/api/parking-reservations', {
            method: 'POST',
            body: {
                parkingSpaceId: parseInt(spaceId),
                reservationDate: reservationDate,
                timePeriod: timePeriod,
            },
        });
        
        showSuccess('Parking space reserved successfully!');
        
        setTimeout(() => {
            window.location.href = '/pages/bookings.html';
        }, 1500);
    } catch (error) {
        if (error.message.includes('already have a parking reservation') || error.message.includes('overlapping')) {
            showError(error.message || 'You already have a parking reservation for overlapping periods. You cannot book multiple parking spaces for overlapping periods on the same date.');
        } else if (error.message.includes('already reserved by another user')) {
            showError(error.message || 'This parking space is already reserved by another user for the selected date and time period. Please check availability again.');
            checkAvailability();
        } else if (error.message.includes('not available') || error.message.includes('unavailable')) {
            showError('This parking space is no longer available for the selected date and time period. Please check availability again.');
            checkAvailability();
        } else {
            showError('Failed to reserve parking space: ' + error.message);
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

