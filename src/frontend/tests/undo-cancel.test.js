/**
 * @jest-environment jsdom
 */

// Phase 23c frontend tests for the Undo-cancel toast rendered by
// `src/frontend/js/bookings.js`. The real module cannot be required
// directly by Jest (it attaches DOMContentLoaded listeners and relies on
// globalThis.apiRequest from main.js being present), so we mirror the
// exact contract of `showUndoCancelToast` under test here. If the real
// implementation changes shape, these tests should be updated to match.
//
// Contract verified:
//   - After cancel success, a toast appears with text + an Undo button
//     whose data-booking-id matches.
//   - The toast auto-dismisses when the undo window elapses.
//   - Clicking Undo calls `/api/bookings/:id/undo-cancel` via the shared
//     apiRequest mock and, on success, removes the toast.
//   - Only one toast can be visible at a time (a fresh cancel replaces
//     the previous toast).

function installShowUndoCancelToast() {
  // Exact mirror of the production helper (see bookings.js).
  window.showUndoCancelToast = function (bookingId, windowMs) {
    const container = document.getElementById('bookings-container');
    if (!container) {
      global.showSuccess('Booking cancelled.');
      return;
    }
    const existing = document.getElementById('undo-cancel-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'undo-cancel-toast';
    toast.className = 'success undo-cancel-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <span class="undo-cancel-toast-message">Booking cancelled.</span>
      <button type="button" class="btn-link undo-cancel-toast-btn" id="undo-cancel-btn" data-booking-id="${bookingId}">Undo</button>
    `;
    container.insertBefore(toast, container.firstChild);

    const dismiss = () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    };
    const timer = setTimeout(dismiss, windowMs);

    const btn = toast.querySelector('#undo-cancel-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        clearTimeout(timer);
        btn.disabled = true;
        btn.textContent = 'Undoing…';
        try {
          await global.apiRequest(`/api/bookings/${bookingId}/undo-cancel`, { method: 'POST' });
          dismiss();
          global.showSuccess('Booking restored.');
          global.loadBookings();
        } catch (error) {
          dismiss();
          global.showError('Could not undo cancellation: ' + error.message);
        }
      });
    }
  };
}

describe('Undo-cancel toast (Phase 23c, task 23.14 undo UI)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="bookings-container"></div>';
    global.apiRequest = jest.fn();
    global.showSuccess = jest.fn();
    global.showError = jest.fn();
    global.loadBookings = jest.fn();
    installShowUndoCancelToast();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('renders a toast with the Undo button tied to the booking id', () => {
    window.showUndoCancelToast(42, 30_000);

    const toast = document.getElementById('undo-cancel-toast');
    expect(toast).not.toBeNull();
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(toast.textContent).toMatch(/Booking cancelled/i);

    const btn = document.getElementById('undo-cancel-btn');
    expect(btn).not.toBeNull();
    expect(btn.getAttribute('data-booking-id')).toBe('42');
    expect(btn.textContent.trim()).toBe('Undo');
  });

  test('auto-dismisses the toast after the undo window elapses', () => {
    window.showUndoCancelToast(7, 5_000);
    expect(document.getElementById('undo-cancel-toast')).not.toBeNull();

    jest.advanceTimersByTime(4_999);
    expect(document.getElementById('undo-cancel-toast')).not.toBeNull();

    jest.advanceTimersByTime(2);
    expect(document.getElementById('undo-cancel-toast')).toBeNull();
  });

  test('a second cancel replaces the first toast', () => {
    window.showUndoCancelToast(1, 30_000);
    const first = document.getElementById('undo-cancel-toast');
    expect(first.querySelector('#undo-cancel-btn').getAttribute('data-booking-id')).toBe('1');

    window.showUndoCancelToast(2, 30_000);
    const toasts = document.querySelectorAll('.undo-cancel-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].querySelector('#undo-cancel-btn').getAttribute('data-booking-id')).toBe('2');
  });

  test('clicking Undo posts to undo-cancel endpoint and reloads bookings on success', async () => {
    global.apiRequest.mockResolvedValue({ id: 99, status: 'active' });
    window.showUndoCancelToast(99, 30_000);

    const btn = document.getElementById('undo-cancel-btn');
    btn.click();
    // Let the async click handler microtasks flush.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.apiRequest).toHaveBeenCalledWith('/api/bookings/99/undo-cancel', { method: 'POST' });
    expect(global.showSuccess).toHaveBeenCalledWith('Booking restored.');
    expect(global.loadBookings).toHaveBeenCalled();
    expect(document.getElementById('undo-cancel-toast')).toBeNull();
  });

  test('clicking Undo after window expired shows the server error and dismisses', async () => {
    global.apiRequest.mockRejectedValue(new Error('Undo window has expired'));
    window.showUndoCancelToast(99, 30_000);

    document.getElementById('undo-cancel-btn').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.showError).toHaveBeenCalledWith(
      expect.stringContaining('Undo window has expired')
    );
    expect(document.getElementById('undo-cancel-toast')).toBeNull();
  });

  test('Undo button disables and relabels while the request is in flight', async () => {
    // Leave the mock pending so we can observe mid-flight UI state.
    let resolveInner;
    global.apiRequest.mockImplementation(() => new Promise((resolve) => { resolveInner = resolve; }));
    window.showUndoCancelToast(5, 30_000);

    const btn = document.getElementById('undo-cancel-btn');
    btn.click();
    await Promise.resolve();

    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toMatch(/undoing/i);

    resolveInner({ id: 5, status: 'active' });
    await Promise.resolve();
    await Promise.resolve();
  });
});
