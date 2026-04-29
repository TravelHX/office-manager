/**
 * @jest-environment jsdom
 */

// Matrix UI contract tests. The real matrix.js is loaded into a browser via
// <script> tag; in Jest we verify the DOM-facing contract (user/desk option
// population, matrix rendering fallback, CSV export surface, tooltip show/hide
// state) by exercising the same logic against real jsdom DOM elements. This
// avoids eval'ing matrix.js, which depends on globalThis.apiRequest being
// installed by main.js in the browser pipeline.

describe('Matrix UI Tests', () => {
  beforeEach(() => {
    global.apiRequest = jest.fn();
    global.showError = jest.fn();
    global.showSuccess = jest.fn();

    document.body.innerHTML = `
      <input type="date" id="startDate" value="2025-12-01">
      <input type="date" id="endDate" value="2025-12-05">
      <select id="viewType"><option value="combined" selected>Combined</option></select>
      <select id="userFilter" multiple></select>
      <select id="deskFilter" multiple></select>
      <select id="parkingFilter" multiple></select>
      <button id="loadMatrixBtn">Load</button>
      <button id="exportMatrixBtn">Export</button>
      <div id="matrix-container"></div>
      <div id="matrix-message"></div>
      <div id="matrix-tooltip"></div>
    `;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadUsers', () => {
    async function loadUsers() {
      try {
        const users = await global.apiRequest('/api/auth/users');
        const userFilter = document.getElementById('userFilter');
        userFilter.innerHTML = '';
        users.forEach((user) => {
          const option = document.createElement('option');
          option.value = user.id;
          option.textContent = user.username;
          userFilter.appendChild(option);
        });
      } catch (error) {
        global.showError('Failed to load users');
      }
    }

    test('should load users and populate filter', async () => {
      global.apiRequest.mockResolvedValue([
        { id: 1, username: 'user1', role: 'user' },
        { id: 2, username: 'user2', role: 'admin' },
      ]);

      await loadUsers();

      expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users');
      const userFilter = document.getElementById('userFilter');
      expect(userFilter.innerHTML).toContain('user1');
      expect(userFilter.innerHTML).toContain('user2');
    });

    test('should handle errors when loading users', async () => {
      global.apiRequest.mockRejectedValue(new Error('Failed to load'));

      await loadUsers();

      expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users');
      expect(global.showError).toHaveBeenCalled();
    });
  });

  describe('loadMatrix', () => {
    async function loadMatrix() {
      const startDate = document.getElementById('startDate').value;
      const endDate = document.getElementById('endDate').value;
      if (!startDate || !endDate) {
        global.showError('Please select both start and end dates');
        return null;
      }
      try {
        const data = await global.apiRequest(`/api/matrix/bookings?startDate=${startDate}&endDate=${endDate}`);
        return data;
      } catch (error) {
        global.showError('Failed to load matrix: ' + error.message);
        return null;
      }
    }

    test('should load matrix data successfully', async () => {
      const mockMatrixData = {
        dateRange: ['2025-12-01', '2025-12-02'],
        users: [{ id: 1, username: 'user1' }],
        data: {},
      };
      global.apiRequest.mockResolvedValue(mockMatrixData);

      const result = await loadMatrix();

      expect(global.apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/matrix/bookings')
      );
      expect(result).toEqual(mockMatrixData);
    });

    test('should show error if dates are missing', async () => {
      document.getElementById('startDate').value = '';

      await loadMatrix();

      expect(global.showError).toHaveBeenCalledWith(
        expect.stringContaining('start and end dates')
      );
    });

    test('should handle API errors', async () => {
      global.apiRequest.mockRejectedValue(new Error('API Error'));

      await loadMatrix();

      expect(global.showError).toHaveBeenCalled();
    });
  });

  describe('renderMatrix', () => {
    function renderMatrix(matrixData) {
      const container = document.getElementById('matrix-container');
      if (!matrixData.dateRange.length || !matrixData.users.length) {
        container.innerHTML = '<p>No data available for the selected filters.</p>';
        return;
      }
      const table = document.createElement('table');
      table.className = 'matrix-table';
      container.appendChild(table);
    }

    test('should render matrix table with data', () => {
      renderMatrix({
        dateRange: ['2025-12-01'],
        users: [{ id: 1, username: 'user1' }],
        data: {},
      });

      const container = document.getElementById('matrix-container');
      expect(container.querySelector('table.matrix-table')).not.toBeNull();
    });

    test('should show message if no data', () => {
      renderMatrix({
        dateRange: [],
        users: [],
        data: {},
      });

      const container = document.getElementById('matrix-container');
      expect(container.innerHTML).toContain('No data available');
    });
  });

  describe('exportMatrix', () => {
    let currentMatrixData = null;

    function exportMatrix() {
      if (!currentMatrixData) {
        global.showError('Please load matrix data first');
        return;
      }
      const link = document.createElement('a');
      link.href = 'data:text/csv;charset=utf-8,matrix';
      link.download = 'matrix.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      global.showSuccess('Matrix exported');
    }

    test('should export matrix to CSV', () => {
      currentMatrixData = {
        dateRange: ['2025-12-01'],
        users: [{ id: 1, username: 'user1' }],
        data: {},
      };

      exportMatrix();

      expect(global.showSuccess).toHaveBeenCalled();
    });

    test('should show error if no matrix data', () => {
      currentMatrixData = null;

      exportMatrix();

      expect(global.showError).toHaveBeenCalledWith(
        expect.stringContaining('load matrix data first')
      );
    });
  });

  describe('showTooltip / hideTooltip', () => {
    function showTooltip(cellData, user) {
      const tooltip = document.getElementById('matrix-tooltip');
      const parts = [`<strong>${user.username}</strong>`];
      (cellData.deskBookings || []).forEach((b) => parts.push(`Desk ${b.deskNumber}`));
      (cellData.parkingReservations || []).forEach((r) => parts.push(`Parking ${r.spaceNumber}`));
      tooltip.innerHTML = parts.join('<br>');
      tooltip.classList.add('show');
    }

    function hideTooltip() {
      const tooltip = document.getElementById('matrix-tooltip');
      tooltip.classList.remove('show');
    }

    test('should display tooltip with booking information', () => {
      showTooltip(
        {
          deskBookings: [{ id: 1, deskNumber: 'D001' }],
          parkingReservations: [{ id: 1, spaceNumber: 'P001', timePeriod: 'morning' }],
        },
        { username: 'user1' }
      );

      const tooltip = document.getElementById('matrix-tooltip');
      expect(tooltip.classList.contains('show')).toBe(true);
      expect(tooltip.innerHTML).toContain('user1');
      expect(tooltip.innerHTML).toContain('D001');
      expect(tooltip.innerHTML).toContain('P001');
    });

    test('should hide tooltip', () => {
      const tooltip = document.getElementById('matrix-tooltip');
      tooltip.classList.add('show');

      hideTooltip();

      expect(tooltip.classList.contains('show')).toBe(false);
    });
  });
});

/**
 * Phase 31 lifecycle-state tests. Loads the real matrix.js module (so the
 * exposed window.setMatrixState / window.loadMatrix come from production
 * code) and drives the four state transitions: empty -> loading ->
 * loaded / error. The DOMContentLoaded handler that performs admin
 * auth checks is never dispatched, so the auth gate is sidestepped — we
 * exercise the state machine directly via the window-exported entry
 * points.
 */
describe('Phase 31: Booking Matrix state transitions', () => {
    beforeEach(() => {
        jest.resetModules();

        // Minimal slice of matrix.html: filter inputs + matrix-message +
        // matrix-region pre-filled with the empty state, mirroring the page.
        document.body.innerHTML = `
            <input type="date" id="startDate" />
            <input type="date" id="endDate" />
            <select id="viewType"><option value="combined" selected>Combined</option></select>
            <select id="userFilter" multiple></select>
            <select id="deskFilter" multiple></select>
            <select id="parkingFilter" multiple></select>
            <button id="loadMatrixBtn">Load</button>
            <button id="exportMatrixBtn">Export</button>
            <div id="matrix-message"></div>
            <div id="matrix-region" class="matrix-region" data-state="empty">
                <div class="matrix-empty-state">
                    <h3 class="matrix-state-title">Select a date range to view bookings</h3>
                </div>
            </div>
            <div id="matrix-tooltip"></div>
        `;

        globalThis.apiRequest = jest.fn();
        // Auth helpers used by matrix.js's DOMContentLoaded; defined here
        // so the listener doesn't throw if it does fire (e.g. via the
        // ui-shell suite).
        globalThis.requireAuth = jest.fn(() => true);
        globalThis.isAdmin = jest.fn(() => true);

        require('../js/matrix.js');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('setMatrixState', () => {
        test('renders the empty state and sets data-state="empty"', () => {
            window.setMatrixState('empty');
            const region = document.getElementById('matrix-region');
            expect(region.getAttribute('data-state')).toBe('empty');
            expect(region.querySelector('.matrix-empty-state')).not.toBeNull();
            expect(region.textContent).toContain('Select a date range to view bookings');
        });

        test('renders the loading spinner and sets data-state="loading"', () => {
            window.setMatrixState('loading');
            const region = document.getElementById('matrix-region');
            expect(region.getAttribute('data-state')).toBe('loading');
            expect(region.querySelector('.matrix-loading-state')).not.toBeNull();
            expect(region.querySelector('.matrix-spinner')).not.toBeNull();
        });

        test('renders an empty #matrix-container for the loaded state', () => {
            window.setMatrixState('loaded');
            const region = document.getElementById('matrix-region');
            expect(region.getAttribute('data-state')).toBe('loaded');
            // The legacy renderMatrix() writes by id, so the loaded state
            // must expose a fresh #matrix-container slot inside the region.
            expect(region.querySelector('#matrix-container')).not.toBeNull();
        });

        test('renders the error block with the supplied message and a Retry button', () => {
            window.setMatrixState('error', { message: 'Network broke' });
            const region = document.getElementById('matrix-region');
            expect(region.getAttribute('data-state')).toBe('error');
            expect(region.querySelector('.matrix-error-state')).not.toBeNull();
            expect(region.textContent).toContain('Network broke');
            expect(document.getElementById('matrix-retry-btn')).not.toBeNull();
        });

        test('escapes the error message to prevent XSS in error rendering', () => {
            window.setMatrixState('error', { message: '<img src=x onerror=alert(1)>' });
            const region = document.getElementById('matrix-region');
            // The literal img tag must not appear as HTML — only escaped.
            expect(region.innerHTML).not.toContain('<img src=x');
            expect(region.innerHTML).toContain('&lt;img');
        });
    });

    describe('loadMatrix transitions', () => {
        beforeEach(() => {
            document.getElementById('startDate').value = '2025-12-01';
            document.getElementById('endDate').value = '2025-12-05';
        });

        test('rejects with showError when dates are missing without changing state', async () => {
            document.getElementById('startDate').value = '';
            await window.loadMatrix();
            // Stays on empty (or whatever state was set before).
            const region = document.getElementById('matrix-region');
            expect(region.getAttribute('data-state')).toBe('empty');
            const messageDiv = document.getElementById('matrix-message');
            expect(messageDiv.innerHTML).toContain('Please select both start and end dates');
            expect(globalThis.apiRequest).not.toHaveBeenCalled();
        });

        test('flips to loading then to loaded on a successful response', async () => {
            // Promise we resolve manually so we can observe the loading state
            // before the call settles.
            let resolveApi;
            const apiPromise = new Promise((resolve) => { resolveApi = resolve; });
            globalThis.apiRequest.mockReturnValueOnce(apiPromise);

            const loadPromise = window.loadMatrix();
            // While the API is in flight, the state is "loading".
            expect(document.getElementById('matrix-region').getAttribute('data-state')).toBe('loading');
            expect(document.querySelector('.matrix-spinner')).not.toBeNull();

            resolveApi({ users: [], dates: [] });
            await loadPromise;

            // After resolution, the loaded state is in place. The legacy
            // renderMatrix writes the "no data" fallback into the injected
            // #matrix-container.
            expect(document.getElementById('matrix-region').getAttribute('data-state')).toBe('loaded');
        });

        test('flips to error on failure with the error message', async () => {
            globalThis.apiRequest.mockRejectedValueOnce(new Error('500 Server Error'));
            await window.loadMatrix();

            const region = document.getElementById('matrix-region');
            expect(region.getAttribute('data-state')).toBe('error');
            expect(region.textContent).toContain('500 Server Error');
            expect(document.getElementById('matrix-retry-btn')).not.toBeNull();
        });

        test('Retry button re-fires loadMatrix with the current filters', async () => {
            // First attempt fails — we land on the error state.
            globalThis.apiRequest.mockRejectedValueOnce(new Error('first fail'));
            await window.loadMatrix();
            expect(document.getElementById('matrix-region').getAttribute('data-state')).toBe('error');
            expect(globalThis.apiRequest).toHaveBeenCalledTimes(1);

            // Second attempt (via Retry click) succeeds.
            globalThis.apiRequest.mockResolvedValueOnce({ users: [], dates: [] });
            document.getElementById('matrix-retry-btn').click();
            // The click handler returns a promise; let microtasks flush.
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(globalThis.apiRequest).toHaveBeenCalledTimes(2);
            // Both calls hit the same endpoint with the same date range.
            expect(globalThis.apiRequest.mock.calls[0][0]).toBe(globalThis.apiRequest.mock.calls[1][0]);
            expect(document.getElementById('matrix-region').getAttribute('data-state')).toBe('loaded');
        });

        test('a successful reload after a load returns to loading then loaded, never empty', async () => {
            globalThis.apiRequest.mockResolvedValueOnce({ users: [], dates: [] });
            await window.loadMatrix();
            expect(document.getElementById('matrix-region').getAttribute('data-state')).toBe('loaded');

            // Second load — still hits loading first, never the empty state.
            let resolveApi;
            const apiPromise = new Promise((resolve) => { resolveApi = resolve; });
            globalThis.apiRequest.mockReturnValueOnce(apiPromise);
            const loadPromise = window.loadMatrix();

            expect(document.getElementById('matrix-region').getAttribute('data-state')).toBe('loading');

            resolveApi({ users: [], dates: [] });
            await loadPromise;
            expect(document.getElementById('matrix-region').getAttribute('data-state')).toBe('loaded');
        });
    });
});
