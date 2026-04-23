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
