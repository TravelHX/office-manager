// Desk Booking JavaScript

let selectedDeskId = null;

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
        // Auto-check availability when dates change if both dates are selected
        if (startDateInput.value && endDateInput.value) {
            checkAvailability();
        }
    });
    
    endDateInput.addEventListener('change', () => {
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
        return;
    }
    
    const desksHTML = `
        <h3>Available Desks</h3>
        <div class="desks-grid">
            ${desks.map(desk => `
                <div class="desk-card" data-desk-id="${desk.id}">
                    <h4><strong>Desk ${desk.deskNumber}</strong></h4>
                    ${desk.location ? `<p><strong>Location:</strong> ${desk.location}</p>` : ''}
                    ${desk.description ? `<p>${desk.description}</p>` : ''}
                    <button class="btn-primary book-desk-btn" data-desk-id="${desk.id}" data-desk-number="${desk.deskNumber}">Book This Desk</button>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = desksHTML;
    
    document.querySelectorAll('.book-desk-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const deskId = btn.getAttribute('data-desk-id');
            const deskNumber = btn.getAttribute('data-desk-number');
            bookDesk(deskId, deskNumber, startDate, endDate);
        });
    });
}

async function bookDesk(deskId, deskNumber, startDate, endDate) {
    if (!confirm(`Confirm booking for Desk ${deskNumber} from ${startDate} to ${endDate}?`)) {
        return;
    }
    
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

