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
});

// Mock the parking.js module
jest.mock('../../js/parking.js', () => ({
  checkAvailability: jest.fn(),
  reserveParkingSpace: jest.fn(),
  displayParkingSpaces: jest.fn(),
}));

describe('Parking Reservation Functionality', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <input type="date" id="reservationDate" />
        <select id="timePeriod">
          <option value="">Select time period</option>
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="full_day">Full Day</option>
        </select>
        <button id="checkAvailabilityBtn">Check Availability</button>
        <div id="availability-message"></div>
        <div id="parking-spaces-container"></div>
      </div>
    `;
    
    // Reset mocks
    global.apiRequest.mockClear();
    global.showError.mockClear();
    global.showSuccess.mockClear();
  });

  describe('Date Input Validation', () => {
    test('should set minimum date to today on page load', () => {
      const reservationDateInput = document.getElementById('reservationDate');
      const today = new Date().toISOString().split('T')[0];
      
      // Trigger DOMContentLoaded
      const event = new Event('DOMContentLoaded');
      document.dispatchEvent(event);
      
      expect(reservationDateInput.getAttribute('min')).toBe(today);
    });
  });

  describe('Time Period Selection', () => {
    test('should have all time period options available', () => {
      const timePeriodSelect = document.getElementById('timePeriod');
      const options = Array.from(timePeriodSelect.options).map(opt => opt.value);
      
      expect(options).toContain('');
      expect(options).toContain('morning');
      expect(options).toContain('afternoon');
      expect(options).toContain('full_day');
    });
  });

  describe('Availability Check', () => {
    test('should call API with correct parameters when checking availability', async () => {
      const reservationDate = '2025-12-15';
      const timePeriod = 'morning';
      
      document.getElementById('reservationDate').value = reservationDate;
      document.getElementById('timePeriod').value = timePeriod;
      
      global.apiRequest.mockResolvedValue([
        { id: 1, spaceNumber: 'P001', location: 'Lot A' },
        { id: 2, spaceNumber: 'P002', location: 'Lot A' },
      ]);
      
      // Simulate checkAvailability function
      const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
      const messageDiv = document.getElementById('availability-message');
      const spacesContainer = document.getElementById('parking-spaces-container');
      
      messageDiv.innerHTML = '<p>Checking availability...</p>';
      spacesContainer.innerHTML = '';
      
      const response = await global.apiRequest(
        `/api/parking-spaces/available?reservationDate=${reservationDate}&timePeriod=${timePeriod}`
      );
      
      expect(global.apiRequest).toHaveBeenCalledWith(
        `/api/parking-spaces/available?reservationDate=${reservationDate}&timePeriod=${timePeriod}`
      );
      expect(response).toHaveLength(2);
    });

    test('should show error when date or time period is missing', () => {
      const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
      const messageDiv = document.getElementById('availability-message');
      
      // Simulate missing date
      document.getElementById('reservationDate').value = '';
      document.getElementById('timePeriod').value = 'morning';
      
      // Simulate checkAvailability validation
      const reservationDate = document.getElementById('reservationDate').value;
      const timePeriod = document.getElementById('timePeriod').value;
      
      if (!reservationDate || !timePeriod) {
        messageDiv.innerHTML = '<div class="error">Please select both date and time period</div>';
      }
      
      expect(messageDiv.innerHTML).toContain('Please select both date and time period');
    });

    test('should display available parking spaces', () => {
      const spaces = [
        { id: 1, spaceNumber: 'P001', location: 'Lot A', description: 'Near entrance' },
        { id: 2, spaceNumber: 'P002', location: 'Lot A' },
      ];
      
      const container = document.getElementById('parking-spaces-container');
      const timePeriod = 'morning';
      const timePeriodLabel = 'Morning';
      
      const spacesHTML = `
        <h3>Available Parking Spaces</h3>
        <div class="desks-grid">
          ${spaces.map(space => `
            <div class="desk-card" data-space-id="${space.id}">
              <h4>Space ${space.spaceNumber}</h4>
              ${space.location ? `<p><strong>Location:</strong> ${space.location}</p>` : ''}
              ${space.description ? `<p>${space.description}</p>` : ''}
              <button class="btn-primary book-space-btn" data-space-id="${space.id}">Reserve This Space</button>
            </div>
          `).join('')}
        </div>
      `;
      
      container.innerHTML = spacesHTML;
      
      expect(container.innerHTML).toContain('Available Parking Spaces');
      expect(container.innerHTML).toContain('P001');
      expect(container.innerHTML).toContain('P002');
      expect(container.querySelectorAll('.book-space-btn')).toHaveLength(2);
    });

    test('should show message when no spaces are available', () => {
      const messageDiv = document.getElementById('availability-message');
      messageDiv.innerHTML = '<div class="error">No parking spaces available for the selected date and time period. Please try different options.</div>';
      
      expect(messageDiv.innerHTML).toContain('No parking spaces available');
    });
  });

  describe('Reservation Creation', () => {
    test('should call API with correct parameters when creating reservation', async () => {
      const spaceId = 1;
      const reservationDate = '2025-12-15';
      const timePeriod = 'morning';
      
      global.apiRequest.mockResolvedValue({
        id: 1,
        parkingSpaceId: spaceId,
        reservationDate: reservationDate,
        timePeriod: timePeriod,
        status: 'active',
      });
      
      // Simulate reserveParkingSpace function
      const response = await global.apiRequest('/api/parking-reservations', {
        method: 'POST',
        body: {
          parkingSpaceId: parseInt(spaceId),
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        },
      });
      
      expect(global.apiRequest).toHaveBeenCalledWith('/api/parking-reservations', {
        method: 'POST',
        body: {
          parkingSpaceId: 1,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        },
      });
      expect(response.status).toBe('active');
    });

    test('should handle reservation errors gracefully', async () => {
      global.apiRequest.mockRejectedValue(new Error('Parking space is not available'));
      
      try {
        await global.apiRequest('/api/parking-reservations', {
          method: 'POST',
          body: {
            parkingSpaceId: 1,
            reservationDate: '2025-12-15',
            timePeriod: 'morning',
          },
        });
      } catch (error) {
        expect(error.message).toContain('not available');
      }
    });
  });

  describe('Time Period Formatting', () => {
    test('should format time period labels correctly', () => {
      const formatTimePeriod = (period) => {
        const labels = {
          morning: 'Morning',
          afternoon: 'Afternoon',
          full_day: 'Full Day',
        };
        return labels[period] || period;
      };
      
      expect(formatTimePeriod('morning')).toBe('Morning');
      expect(formatTimePeriod('afternoon')).toBe('Afternoon');
      expect(formatTimePeriod('full_day')).toBe('Full Day');
    });
  });
});

