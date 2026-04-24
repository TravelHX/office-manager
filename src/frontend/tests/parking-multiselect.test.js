/**
 * @jest-environment jsdom
 *
 * Phase 15: multi-select parking reservation (15.38) and selection persistence
 * during scroll (15.40). Unlike the existing `parking.test.js` which mocks the
 * module, this suite loads the real `parking.js` so the multi-select code path
 * is actually exercised.
 */

function loadParkingPage() {
  window.location.pathname = '/pages/parking.html';
  window.location.search = '';
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
  jest.resetModules();
  require('../js/main.js');
  globalThis.apiRequest = jest.fn();
  require('../js/parking.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

describe('Parking multi-select (Phase 15.38, 15.40)', () => {
  beforeEach(() => {
    localStorage.clear();
    loadParkingPage();
  });

  test('multi-select reserves all selected parking spaces in a single bulk call (15.38)', async () => {
    // Render two spaces via the real display function so event listeners are
    // bound and the selection controls are created.
    const spaces = [
      { id: 1, spaceNumber: 'P001', location: 'Lot A' },
      { id: 2, spaceNumber: 'P002', location: 'Lot A' },
    ];
    window.displayParkingSpaces(spaces, '2025-12-15', 'morning');

    // Start with a clean selection.
    window.selectedParkingSpaceIds.clear();

    // User clicks Select on both cards.
    const container = document.getElementById('parking-spaces-container');
    container.querySelectorAll('.select-space-btn').forEach((btn) => btn.click());

    expect(window.selectedParkingSpaceIds.size).toBe(2);
    expect(window.selectedParkingSpaceIds.has('1')).toBe(true);
    expect(window.selectedParkingSpaceIds.has('2')).toBe(true);

    // The selection-count text and the Reserve Selected button must reflect
    // the count.
    const countEl = document.getElementById('parking-selection-count');
    const reserveSelectedBtn = document.getElementById('reserve-selected-btn');
    expect(countEl.textContent).toContain('2');
    expect(reserveSelectedBtn.disabled).toBe(false);

    // Bulk reserve: API resolves with a successful response.
    globalThis.apiRequest.mockResolvedValueOnce({
      successful: [
        { id: 1, parkingSpaceId: 1 },
        { id: 2, parkingSpaceId: 2 },
      ],
      failed: [],
      errors: [],
    });

    await window.reserveSelectedParkingSpaces('2025-12-15', 'morning');

    expect(globalThis.apiRequest).toHaveBeenCalledWith('/api/parking-reservations/bulk', {
      method: 'POST',
      body: {
        parkingSpaceIds: [1, 2],
        reservationDate: '2025-12-15',
        timePeriod: 'morning',
      },
    });

    // After a successful bulk reservation the selection is cleared so the
    // user cannot accidentally re-book.
    expect(window.selectedParkingSpaceIds.size).toBe(0);
  });

  test('single Reserve button still uses the single-reservation endpoint when multi-select is unused (15.39 parking)', async () => {
    const spaces = [{ id: 7, spaceNumber: 'P007', location: 'Lot A' }];
    window.displayParkingSpaces(spaces, '2025-12-15', 'afternoon');

    globalThis.apiRequest.mockResolvedValueOnce({
      id: 42,
      parkingSpaceId: 7,
      reservationDate: '2025-12-15',
      timePeriod: 'afternoon',
      status: 'active',
    });

    // Click the per-card Reserve button (not Select); selection Set must
    // remain empty and the single-reservation endpoint must be called.
    const container = document.getElementById('parking-spaces-container');
    const reserveBtn = container.querySelector('.book-space-btn');
    reserveBtn.click();

    // Allow the click handler's async work to complete.
    await Promise.resolve();
    await Promise.resolve();

    expect(globalThis.apiRequest).toHaveBeenCalledWith('/api/parking-reservations', {
      method: 'POST',
      body: {
        parkingSpaceId: 7,
        reservationDate: '2025-12-15',
        timePeriod: 'afternoon',
      },
    });
    expect(window.selectedParkingSpaceIds.size).toBe(0);
  });

  test('parking selection persists across a scroll event on the spaces container (15.40)', () => {
    const spaces = [
      { id: 1, spaceNumber: 'P001', location: 'Lot A' },
      { id: 2, spaceNumber: 'P002', location: 'Lot A' },
      { id: 3, spaceNumber: 'P003', location: 'Lot B' },
    ];
    window.displayParkingSpaces(spaces, '2025-12-15', 'full_day');

    // Select the first two spaces.
    window.selectedParkingSpaceIds.clear();
    const container = document.getElementById('parking-spaces-container');
    const selectButtons = container.querySelectorAll('.select-space-btn');
    selectButtons[0].click();
    selectButtons[1].click();

    expect(window.selectedParkingSpaceIds.size).toBe(2);

    // Simulate the user scrolling the parking spaces list. Selection is held
    // in an in-memory Set; nothing about scrolling should alter it.
    container.dispatchEvent(new Event('scroll', { bubbles: true }));
    window.dispatchEvent(new Event('scroll'));

    expect(window.selectedParkingSpaceIds.size).toBe(2);
    expect(window.selectedParkingSpaceIds.has('1')).toBe(true);
    expect(window.selectedParkingSpaceIds.has('2')).toBe(true);

    // The selected cards must still carry the selected class and indicator.
    const cards = container.querySelectorAll('.desk-card[data-space-id]');
    const selectedCards = Array.from(cards).filter((card) =>
      card.classList.contains('selected')
    );
    expect(selectedCards.length).toBe(2);
    selectedCards.forEach((card) => {
      expect(card.querySelector('.selection-indicator')).not.toBeNull();
    });
  });
});
