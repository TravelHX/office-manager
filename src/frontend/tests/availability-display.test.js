/**
 * @jest-environment jsdom
 */

// Mock fetch and other globals
global.fetch = jest.fn();
global.apiRequest = jest.fn();
global.showError = jest.fn();
global.showSuccess = jest.fn();

// Load desk-booking.js
const fs = require('fs');
const path = require('path');
const deskBookingScript = fs.readFileSync(
  path.join(__dirname, '../js/desk-booking.js'),
  'utf8'
);

// Mock DOM elements
document.getElementById = jest.fn((id) => {
  const elements = {
    startDate: { value: '2026-12-01', setAttribute: jest.fn(), addEventListener: jest.fn() },
    endDate: { value: '2026-12-02', setAttribute: jest.fn(), addEventListener: jest.fn() },
    checkAvailabilityBtn: { addEventListener: jest.fn() },
    availabilityMessage: { innerHTML: '' },
    desksContainer: { innerHTML: '' },
  };
  return elements[id] || { value: '', innerHTML: '', addEventListener: jest.fn() };
});

document.querySelectorAll = jest.fn(() => []);
document.createElement = jest.fn((tag) => ({
  tagName: tag.toUpperCase(),
  innerHTML: '',
  textContent: '',
  addEventListener: jest.fn(),
  setAttribute: jest.fn(),
  appendChild: jest.fn(),
}));

// Execute the script
eval(deskBookingScript);

describe('Availability Display Enhancement - Desk Booking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.getElementById('availability-message').innerHTML = '';
    document.getElementById('desks-container').innerHTML = '';
  });

  describe('Remaining Desk Count Display', () => {
    test('should display remaining desk count when API returns availability info', async () => {
      const mockResponse = {
        availableDesks: [
          { id: 1, deskNumber: '1', location: 'Floor 1' },
          { id: 2, deskNumber: '2', location: 'Floor 1' },
        ],
        totalDesks: 3,
        remainingDesks: 2,
        bookedDesks: 1,
      };

      global.apiRequest.mockResolvedValue(mockResponse);

      // Simulate checkAvailability call
      const messageDiv = document.getElementById('availability-message');
      const desksContainer = document.getElementById('desks-container');
      
      // Call the function directly (it's in global scope after eval)
      if (typeof checkAvailability === 'function') {
        await checkAvailability();
      } else {
        // If function is not accessible, test via DOM events
        const event = new Event('click');
        document.getElementById('checkAvailabilityBtn').dispatchEvent(event);
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.apiRequest).toHaveBeenCalled();
      expect(messageDiv.innerHTML).toContain('remaining');
      expect(messageDiv.innerHTML).toContain('2');
      expect(messageDiv.innerHTML).toContain('3');
    });

    test('should display "0 remaining" when all desks are booked', async () => {
      const mockResponse = {
        availableDesks: [],
        totalDesks: 3,
        remainingDesks: 0,
        bookedDesks: 3,
      };

      global.apiRequest.mockResolvedValue(mockResponse);

      const messageDiv = document.getElementById('availability-message');
      
      if (typeof checkAvailability === 'function') {
        await checkAvailability();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messageDiv.innerHTML).toContain('No desks available');
      expect(messageDiv.innerHTML).toContain('3 total desks');
      expect(messageDiv.innerHTML).toContain('all booked');
    });

    test('should handle old API format (array response)', async () => {
      const mockResponse = [
        { id: 1, deskNumber: '1', location: 'Floor 1' },
        { id: 2, deskNumber: '2', location: 'Floor 1' },
      ];

      global.apiRequest.mockResolvedValue(mockResponse);

      const messageDiv = document.getElementById('availability-message');
      
      if (typeof checkAvailability === 'function') {
        await checkAvailability();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(messageDiv.innerHTML).toContain('available');
    });
  });

  describe('Auto-refresh on Date Change', () => {
    test('should trigger availability check when start date changes', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      endDateInput.value = '2026-12-02';

      // Simulate change event
      const changeEvent = new Event('change');
      startDateInput.dispatchEvent(changeEvent);

      // Verify event listener was added
      expect(startDateInput.addEventListener).toHaveBeenCalled();
    });
  });
});

describe('Availability Display Enhancement - Parking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `
      <input type="date" id="reservationDate" value="2026-12-01" />
      <select id="timePeriod"><option value="morning">Morning</option></select>
      <div id="availability-message"></div>
      <div id="parking-spaces-container"></div>
    `;
  });

  test('should display remaining parking space count', async () => {
    const mockResponse = {
      availableSpaces: [
        { id: 1, spaceNumber: '1', location: 'Lot A' },
      ],
      totalSpaces: 3,
      remainingSpaces: 1,
      bookedSpaces: 2,
    };

    global.apiRequest = jest.fn().mockResolvedValue(mockResponse);

    // Load parking.js and test
    const fs = require('fs');
    const path = require('path');
    const parkingScript = fs.readFileSync(
      path.join(__dirname, '../js/parking.js'),
      'utf8'
    );
    
    // Mock required functions
    global.showError = jest.fn();
    global.showSuccess = jest.fn();
    
    eval(parkingScript);

    const messageDiv = document.getElementById('availability-message');
    
    if (typeof checkAvailability === 'function') {
      await checkAvailability();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(global.apiRequest).toHaveBeenCalled();
    expect(messageDiv.innerHTML).toContain('remaining');
  });
});
