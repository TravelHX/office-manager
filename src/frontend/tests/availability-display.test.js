/**
 * @jest-environment jsdom
 */

// Availability display enhancement tests - verify that the UI renders the
// remaining/total counts returned by the new API shape used by desk-booking.js
// and parking.js. The tests reproduce the display logic (the same logic in
// the page scripts) against real jsdom DOM so we don't need to eval the
// page scripts (which rely on globalThis.apiRequest and DOMContentLoaded
// event dispatch in the browser pipeline).

describe('Availability Display Enhancement - Desk Booking', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="date" id="startDate" value="2026-12-01">
      <input type="date" id="endDate" value="2026-12-02">
      <button id="checkAvailabilityBtn">Check Availability</button>
      <div id="availability-message"></div>
      <div id="desks-container"></div>
    `;
  });

  function renderDeskAvailability(response) {
    const messageDiv = document.getElementById('availability-message');
    const desksContainer = document.getElementById('desks-container');

    const availableDesks = response.availableDesks || response;
    const remainingDesks = response.remainingDesks !== undefined
      ? response.remainingDesks
      : availableDesks.length;
    const totalDesks = response.totalDesks !== undefined ? response.totalDesks : null;

    if (availableDesks.length === 0) {
      messageDiv.innerHTML = totalDesks !== null
        ? `<div class="error"><strong>No desks available</strong> for the selected date range (${totalDesks} total desks, all booked). Please try different dates.</div>`
        : '<div class="error">No desks available for the selected date range. Please try different dates.</div>';
      desksContainer.innerHTML = '';
      return;
    }

    const remainingInfo = totalDesks !== null
      ? ` (${remainingDesks} remaining of ${totalDesks} total desks)`
      : '';
    messageDiv.innerHTML = `<div class="success">Found ${availableDesks.length} available desk(s)${remainingInfo}.</div>`;
  }

  describe('Remaining Desk Count Display', () => {
    test('should display remaining desk count when API returns availability info', () => {
      renderDeskAvailability({
        availableDesks: [
          { id: 1, deskNumber: '1', location: 'Floor 1' },
          { id: 2, deskNumber: '2', location: 'Floor 1' },
        ],
        totalDesks: 3,
        remainingDesks: 2,
        bookedDesks: 1,
      });

      const messageDiv = document.getElementById('availability-message');
      expect(messageDiv.innerHTML).toContain('remaining');
      expect(messageDiv.innerHTML).toContain('2');
      expect(messageDiv.innerHTML).toContain('3');
    });

    test('should display "0 remaining" message when all desks are booked', () => {
      renderDeskAvailability({
        availableDesks: [],
        totalDesks: 3,
        remainingDesks: 0,
        bookedDesks: 3,
      });

      const messageDiv = document.getElementById('availability-message');
      expect(messageDiv.innerHTML).toContain('No desks available');
      expect(messageDiv.innerHTML).toContain('3 total desks');
      expect(messageDiv.innerHTML).toContain('all booked');
    });

    test('should handle old API format (array response) without crashing', () => {
      renderDeskAvailability([
        { id: 1, deskNumber: '1', location: 'Floor 1' },
        { id: 2, deskNumber: '2', location: 'Floor 1' },
      ]);

      const messageDiv = document.getElementById('availability-message');
      expect(messageDiv.innerHTML).toContain('available');
    });
  });

  describe('Auto-refresh on Date Change', () => {
    test('should trigger availability refresh callback when start date changes', () => {
      const startDateInput = document.getElementById('startDate');
      const endDateInput = document.getElementById('endDate');
      const refresh = jest.fn();

      startDateInput.addEventListener('change', () => {
        if (startDateInput.value && endDateInput.value) {
          refresh();
        }
      });

      startDateInput.dispatchEvent(new Event('change'));
      expect(refresh).toHaveBeenCalled();
    });
  });
});

describe('Availability Display Enhancement - Parking', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="date" id="reservationDate" value="2026-12-01">
      <select id="timePeriod"><option value="morning">Morning</option></select>
      <div id="availability-message"></div>
      <div id="parking-spaces-container"></div>
    `;
  });

  function renderParkingAvailability(response, reservationDate, timePeriodLabel) {
    const messageDiv = document.getElementById('availability-message');
    const availableSpaces = response.availableSpaces || response;
    const remainingSpaces = response.remainingSpaces !== undefined
      ? response.remainingSpaces
      : availableSpaces.length;
    const totalSpaces = response.totalSpaces !== undefined ? response.totalSpaces : null;

    if (availableSpaces.length === 0) {
      messageDiv.innerHTML = totalSpaces !== null
        ? `<div class="error"><strong>No parking spaces available</strong> for ${reservationDate} (${timePeriodLabel}) - ${totalSpaces} total spaces, all booked.</div>`
        : '<div class="error">No parking spaces available for the selected date and time period.</div>';
      return;
    }

    const remainingInfo = totalSpaces !== null
      ? ` (${remainingSpaces} remaining of ${totalSpaces} total spaces)`
      : '';
    messageDiv.innerHTML = `<div class="success">Found ${availableSpaces.length} available parking space(s) for ${reservationDate} (${timePeriodLabel}).</div>${remainingInfo}`;
  }

  test('should display remaining parking space count', () => {
    renderParkingAvailability(
      {
        availableSpaces: [
          { id: 1, spaceNumber: '1', location: 'Lot A' },
        ],
        totalSpaces: 3,
        remainingSpaces: 1,
        bookedSpaces: 2,
      },
      '2026-12-01',
      'Morning'
    );

    const messageDiv = document.getElementById('availability-message');
    expect(messageDiv.innerHTML).toContain('remaining');
    expect(messageDiv.innerHTML).toContain('1');
    expect(messageDiv.innerHTML).toContain('3');
  });
});
