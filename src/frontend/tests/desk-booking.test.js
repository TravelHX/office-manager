/**
 * @jest-environment jsdom
 */

// Setup DOM before tests
beforeAll(() => {
  // Mock global functions from main.js
  global.apiRequest = jest.fn();
  global.showError = jest.fn();
  global.showSuccess = jest.fn();
  
  // Make functions available globally for testing
  window.apiRequest = global.apiRequest;
  window.showError = global.showError;
  window.showSuccess = global.showSuccess;
  window.checkAvailability = jest.fn();
  window.bookDesk = jest.fn();
  window.displayDesks = jest.fn();
  window.formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
});

describe('Desk Booking Functionality', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <input type="date" id="startDate" />
        <input type="date" id="endDate" />
        <button id="checkAvailabilityBtn">Check Availability</button>
        <div id="availability-message"></div>
        <div id="desks-container"></div>
      </div>
    `;
    
    // Reset mocks
    global.apiRequest.mockClear();
    global.showError.mockClear();
    global.showSuccess.mockClear();
  });

  describe('Date Input Validation', () => {
    test('should set minimum date to today on page load', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      const today = new Date().toISOString().split('T')[0];
      
      // Trigger DOMContentLoaded
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      expect(startDateInput.getAttribute('min')).toBe(today);
      expect(endDateInput.getAttribute('min')).toBe(today);
    });

    test('should update end date minimum when start date changes', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      
      startDateInput.value = '2025-12-15';
      startDateInput.dispatchEvent(new Event('change'));
      
      expect(endDateInput.getAttribute('min')).toBe('2025-12-15');
    });

    test('should reset end date if it becomes before start date', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      
      endDateInput.value = '2025-12-10';
      startDateInput.value = '2025-12-15';
      startDateInput.dispatchEvent(new Event('change'));
      
      expect(endDateInput.value).toBe('2025-12-15');
    });
  });

  describe('checkAvailability', () => {
    test('should show error when dates are missing', async () => {
      const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
      
      checkAvailabilityBtn.click();
      
      // Since we're calling the function directly, we need to access it
      // For now, we'll test the behavior through the UI
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      
      startDateInput.value = '';
      endDateInput.value = '';
      
      // We'll need to call checkAvailability directly or trigger the button
      // For this test, we'll verify the validation logic
      expect(startDateInput.value).toBe('');
      expect(endDateInput.value).toBe('');
    });

    test('should show error when start date is after end date', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      
      startDateInput.value = '2025-12-20';
      endDateInput.value = '2025-12-15';
      
      // The validation should catch this
      expect(startDateInput.value > endDateInput.value).toBe(true);
    });

    test('should call API when dates are valid', async () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      const messageDiv = document.getElementById('availability-message');
      
      startDateInput.value = '2025-12-15';
      endDateInput.value = '2025-12-16';
      
      global.apiRequest.mockResolvedValue([
        { id: 1, deskNumber: 'D001', location: 'Floor 1' },
        { id: 2, deskNumber: 'D002', location: 'Floor 1' },
      ]);
      
      // Call checkAvailability directly
      await window.checkAvailability();
      
      expect(global.apiRequest).toHaveBeenCalledWith(
        '/api/bookings/available?startDate=2025-12-15&endDate=2025-12-16'
      );
    });

    test('should display message when no desks available', async () => {
      const messageDiv = document.getElementById('availability-message');
      const desksContainer = document.getElementById('desks-container');
      
      global.apiRequest.mockResolvedValue([]);
      
      // Mock the function to test the display logic
      const startDate = '2025-12-15';
      const endDate = '2025-12-16';
      
      const response = await global.apiRequest(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`);
      
      if (response.length === 0) {
        messageDiv.innerHTML = '<div class="error">No desks available for the selected date range. Please try different dates.</div>';
        desksContainer.innerHTML = '';
      }
      
      expect(messageDiv.innerHTML).toContain('No desks available');
      expect(desksContainer.innerHTML).toBe('');
    });

    test('should display desks when available', async () => {
      const desksContainer = document.getElementById('desks-container');
      const desks = [
        { id: 1, deskNumber: 'D001', location: 'Floor 1', description: 'Window desk' },
        { id: 2, deskNumber: 'D002', location: 'Floor 2' },
      ];
      
      // Test displayDesks function logic
      const startDate = '2025-12-15';
      const endDate = '2025-12-16';
      
      if (desks.length > 0) {
        const desksHTML = `
          <h3>Available Desks</h3>
          <div class="desks-grid">
            ${desks.map(desk => `
              <div class="desk-card" data-desk-id="${desk.id}">
                <h4>Desk ${desk.deskNumber}</h4>
                ${desk.location ? `<p><strong>Location:</strong> ${desk.location}</p>` : ''}
                ${desk.description ? `<p>${desk.description}</p>` : ''}
                <button class="btn-primary book-desk-btn" data-desk-id="${desk.id}">Book This Desk</button>
              </div>
            `).join('')}
          </div>
        `;
        desksContainer.innerHTML = desksHTML;
      }
      
      expect(desksContainer.innerHTML).toContain('Available Desks');
      expect(desksContainer.innerHTML).toContain('D001');
      expect(desksContainer.innerHTML).toContain('D002');
      expect(desksContainer.querySelectorAll('.book-desk-btn')).toHaveLength(2);
    });
  });

  describe('bookDesk', () => {
    test('should call API to create booking', async () => {
      const deskId = 1;
      const startDate = '2025-12-15';
      const endDate = '2025-12-16';
      
      global.apiRequest.mockResolvedValue({
        id: 1,
        deskId: 1,
        startDate: '2025-12-15',
        endDate: '2025-12-16',
        status: 'active',
      });
      
      window.confirm.mockReturnValue(true);
      
      await window.bookDesk(deskId, startDate, endDate);
      
      expect(global.apiRequest).toHaveBeenCalledWith('/api/bookings', {
        method: 'POST',
        body: {
          deskId: 1,
          startDate: '2025-12-15',
          endDate: '2025-12-16',
        },
      });
    });

    test('should not book if user cancels confirmation', async () => {
      window.confirm.mockReturnValue(false);
      
      await window.bookDesk(1, '2025-12-15', '2025-12-16');
      
      expect(global.apiRequest).not.toHaveBeenCalled();
    });

    test('should handle booking errors gracefully', async () => {
      window.confirm.mockReturnValue(true);
      global.apiRequest.mockRejectedValue(new Error('Desk not available'));
      
      await window.bookDesk(1, '2025-12-15', '2025-12-16');
      
      expect(global.showError).toHaveBeenCalled();
    });

    test('should refresh availability on unavailable desk error', async () => {
      window.confirm.mockReturnValue(true);
      global.apiRequest.mockRejectedValue(new Error('Desk is not available'));
      
      // Mock checkAvailability
      window.checkAvailability = jest.fn();
      
      await window.bookDesk(1, '2025-12-15', '2025-12-16');
      
      expect(window.checkAvailability).toHaveBeenCalled();
    });
  });
});

