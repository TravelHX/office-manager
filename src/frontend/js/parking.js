// Parking Reservation JavaScript

let selectedParkingSpaceId = null;

document.addEventListener('DOMContentLoaded', () => {
    const reservationDateInput = document.getElementById('reservationDate');
    const timePeriodSelect = document.getElementById('timePeriod');
    const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
    
    const today = new Date().toISOString().split('T')[0];
    reservationDateInput.setAttribute('min', today);
    
    checkAvailabilityBtn.addEventListener('click', checkAvailability);
    
    // Auto-check availability when date or time period changes
    reservationDateInput.addEventListener('change', () => {
        if (reservationDateInput.value && timePeriodSelect.value) {
            checkAvailability();
        }
    });
    
    timePeriodSelect.addEventListener('change', () => {
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
        return;
    }
    
    const timePeriodLabel = timePeriod === 'morning' ? 'Morning' : timePeriod === 'afternoon' ? 'Afternoon' : 'Full Day';
    
    const spacesHTML = `
        <h3>Available Parking Spaces</h3>
        <div class="desks-grid">
            ${spaces.map(space => `
                <div class="desk-card" data-space-id="${space.id}">
                    <h4><strong>Space ${space.spaceNumber}</strong></h4>
                    ${space.location ? `<p><strong>Location:</strong> ${space.location}</p>` : ''}
                    ${space.description ? `<p>${space.description}</p>` : ''}
                    <button class="btn-primary book-space-btn" data-space-id="${space.id}" data-space-number="${space.spaceNumber}">Reserve This Space</button>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = spacesHTML;
    
    document.querySelectorAll('.book-space-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const spaceId = btn.getAttribute('data-space-id');
            const spaceNumber = btn.getAttribute('data-space-number');
            reserveParkingSpace(spaceId, spaceNumber, reservationDate, timePeriod);
        });
    });
}

async function reserveParkingSpace(spaceId, spaceNumber, reservationDate, timePeriod) {
    const timePeriodLabel = timePeriod === 'morning' ? 'Morning' : timePeriod === 'afternoon' ? 'Afternoon' : 'Full Day';
    
    if (!confirm(`Confirm reservation for Parking Space ${spaceNumber} on ${reservationDate} (${timePeriodLabel})?`)) {
        return;
    }
    
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

