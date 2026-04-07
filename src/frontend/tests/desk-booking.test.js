/**
 * @jest-environment jsdom
 */

function loadDeskBookingPage() {
  window.location.pathname = '/pages/desk-booking.html';
  window.location.search = '';
  document.body.innerHTML = `
    <div class="container">
      <input type="date" id="startDate" />
      <input type="date" id="endDate" />
      <button id="checkAvailabilityBtn">Check Availability</button>
      <div id="availability-message"></div>
      <div id="desks-container"></div>
    </div>
  `;
  jest.resetModules();
  require('../js/main.js');
  globalThis.apiRequest = jest.fn();
  require('../js/desk-booking.js');
  const event = new Event('DOMContentLoaded');
  document.dispatchEvent(event);
}

describe('Desk Booking', () => {
  beforeEach(() => {
    localStorage.clear();
    loadDeskBookingPage();
  });

  describe('Date inputs', () => {
    test('sets minimum date to today on load', () => {
      const today = new Date().toISOString().split('T')[0];
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      expect(startDateInput.getAttribute('min')).toBe(today);
      expect(endDateInput.getAttribute('min')).toBe(today);
    });

    test('updates end date min when start date changes', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      startDateInput.value = '2025-12-15';
      startDateInput.dispatchEvent(new Event('change'));
      expect(endDateInput.getAttribute('min')).toBe('2025-12-15');
    });

    test('moves end date forward if it is before start date', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      endDateInput.value = '2025-12-10';
      startDateInput.value = '2025-12-15';
      startDateInput.dispatchEvent(new Event('change'));
      expect(endDateInput.value).toBe('2025-12-15');
    });
  });

  describe('checkAvailability', () => {
    test('calls API when dates are valid', async () => {
      globalThis.apiRequest.mockResolvedValue({
        availableDesks: [
          { id: 1, deskNumber: 'D001', location: 'Floor 1' },
        ],
        remainingDesks: 1,
        totalDesks: 10,
      });

      document.getElementById('startDate').value = '2025-12-15';
      document.getElementById('endDate').value = '2025-12-16';

      await window.checkAvailability();

      expect(globalThis.apiRequest.mock.calls[0][0]).toBe(
        '/api/bookings/available?startDate=2025-12-15&endDate=2025-12-16'
      );
    });

    test('bookDesk posts to API', async () => {
      globalThis.apiRequest.mockResolvedValue({
        id: 1,
        deskId: 1,
        startDate: '2025-12-15',
        endDate: '2025-12-16',
        status: 'active',
      });

      await window.bookDesk(1, 'D001', '2025-12-15', '2025-12-16');

      expect(globalThis.apiRequest).toHaveBeenCalledWith('/api/bookings', {
        method: 'POST',
        body: {
          deskId: 1,
          startDate: '2025-12-15',
          endDate: '2025-12-16',
        },
      });
    });
  });

  describe('Multi-select', () => {
    test('exposes selectedDeskIds set on window', () => {
      expect(window.selectedDeskIds).toBeDefined();
      window.selectedDeskIds.clear();
      window.selectedDeskIds.add('1');
      expect(window.selectedDeskIds.has('1')).toBe(true);
    });

    test('bookSelectedDesks calls bulk API', async () => {
      globalThis.apiRequest.mockResolvedValue({
        successful: [{ id: 1, deskId: 1 }],
        failed: [],
        errors: [],
      });
      window.selectedDeskIds.clear();
      window.selectedDeskIds.add('1');
      window.selectedDeskIds.add('2');

      await window.bookSelectedDesks('2025-12-15', '2025-12-16');

      expect(globalThis.apiRequest).toHaveBeenCalledWith('/api/bookings/bulk', {
        method: 'POST',
        body: {
          deskIds: [1, 2],
          startDate: '2025-12-15',
          endDate: '2025-12-16',
        },
      });
    });
  });
});
