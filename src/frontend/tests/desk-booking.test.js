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

    test('hides the per-card Book button when the desk is selected (23.12)', () => {
      const container = document.getElementById('desks-container');
      window.selectedDeskIds.clear();
      window.displayDesks(
        [{ id: 1, deskNumber: 'D001', location: 'Floor 1' }],
        '2025-12-15',
        '2025-12-16'
      );

      const bookBtn = container.querySelector('.book-desk-btn');
      // Pre-condition: nothing selected, Book button visible.
      expect(bookBtn.hidden).toBe(false);

      // Click Select.
      container.querySelector('.select-desk-btn').click();

      // Phase 23.12 / spec section 19: the per-item Book control must not
      // appear for a selected item; Book Selected takes its place.
      expect(bookBtn.hidden).toBe(true);
    });

    test('shows the per-card Book button again when the desk is deselected (23.12)', () => {
      const container = document.getElementById('desks-container');
      window.selectedDeskIds.clear();
      window.displayDesks(
        [{ id: 1, deskNumber: 'D001', location: 'Floor 1' }],
        '2025-12-15',
        '2025-12-16'
      );

      const selectBtn = container.querySelector('.select-desk-btn');
      const bookBtn = container.querySelector('.book-desk-btn');

      selectBtn.click();
      expect(bookBtn.hidden).toBe(true);

      selectBtn.click();
      expect(bookBtn.hidden).toBe(false);
    });

    test('renders the Book button already hidden when the desk is in the selection at render time (23.12)', () => {
      // Seed the Set BEFORE render so the template reflects the selected
      // state on initial paint (e.g. after scroll / filter change).
      window.selectedDeskIds.clear();
      window.selectedDeskIds.add('7');
      window.displayDesks(
        [{ id: 7, deskNumber: 'D007', location: 'Floor 1' }],
        '2025-12-15',
        '2025-12-16'
      );

      const container = document.getElementById('desks-container');
      const bookBtn = container.querySelector('.book-desk-btn');
      // The `hidden` attribute must be present on the rendered markup so the
      // button is not briefly visible before any JS toggle runs.
      expect(bookBtn.hasAttribute('hidden')).toBe(true);
    });

    test('clearSelection un-hides every per-card Book button (23.12)', () => {
      const container = document.getElementById('desks-container');
      window.selectedDeskIds.clear();
      window.displayDesks(
        [
          { id: 1, deskNumber: 'D001' },
          { id: 2, deskNumber: 'D002' },
        ],
        '2025-12-15',
        '2025-12-16'
      );

      // Select both.
      container.querySelectorAll('.select-desk-btn').forEach((btn) => btn.click());
      container.querySelectorAll('.book-desk-btn').forEach((btn) => {
        expect(btn.hidden).toBe(true);
      });

      // Click Clear Selection.
      document.getElementById('clear-selection-btn').click();

      container.querySelectorAll('.book-desk-btn').forEach((btn) => {
        expect(btn.hidden).toBe(false);
      });
    });

    test('selection persists across a scroll event on the desks container (15.40)', () => {
      // Render two desks via the module's own display function so the real
      // event listeners and DOM structure are in place.
      const container = document.getElementById('desks-container');
      const desks = [
        { id: 1, deskNumber: 'D001', location: 'Floor 1' },
        { id: 2, deskNumber: 'D002', location: 'Floor 1' },
      ];
      window.displayDesks(desks, '2025-12-15', '2025-12-16');

      // Pre-condition: nothing selected.
      window.selectedDeskIds.clear();
      expect(window.selectedDeskIds.size).toBe(0);

      // User clicks Select on both desks.
      container.querySelectorAll('.select-desk-btn').forEach((btn) => btn.click());
      expect(window.selectedDeskIds.size).toBe(2);
      expect(window.selectedDeskIds.has('1')).toBe(true);
      expect(window.selectedDeskIds.has('2')).toBe(true);

      // Simulate the user scrolling the desks list. The implementation relies
      // on an in-memory Set rather than re-rendering on scroll, so the
      // selection must be unaffected by any scroll event.
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
      window.dispatchEvent(new Event('scroll'));

      // Set state is preserved and each card still shows the selected class
      // and the selection indicator (the on-card visual cue).
      expect(window.selectedDeskIds.size).toBe(2);
      const cards = container.querySelectorAll('.desk-card');
      cards.forEach((card) => {
        expect(card.classList.contains('selected')).toBe(true);
        expect(card.querySelector('.selection-indicator')).not.toBeNull();
      });
    });
  });
});
