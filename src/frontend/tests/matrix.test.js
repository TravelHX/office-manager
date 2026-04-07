/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

// Load the matrix.js file
const matrixScript = fs.readFileSync(
  path.join(__dirname, '../js/matrix.js'),
  'utf8'
);

// Mock global functions
global.apiRequest = jest.fn();
global.requireAuth = jest.fn(() => true);
global.isAdmin = jest.fn(() => true);
global.showError = jest.fn();
global.showSuccess = jest.fn();

// Mock document methods
document.getElementById = jest.fn((id) => {
  const elements = {
    startDate: { value: '2025-12-01', addEventListener: jest.fn() },
    endDate: { value: '2025-12-05', addEventListener: jest.fn() },
    viewType: { value: 'combined', addEventListener: jest.fn() },
    userFilter: { innerHTML: '', selectedOptions: [], addEventListener: jest.fn() },
    deskFilter: { innerHTML: '', selectedOptions: [], addEventListener: jest.fn() },
    parkingFilter: { innerHTML: '', selectedOptions: [], addEventListener: jest.fn() },
    loadMatrixBtn: { addEventListener: jest.fn() },
    exportMatrixBtn: { addEventListener: jest.fn() },
    matrixContainer: { innerHTML: '' },
    'matrix-message': { innerHTML: '' },
    'matrix-tooltip': { innerHTML: '', classList: { add: jest.fn(), remove: jest.fn() } },
  };
  return elements[id] || { value: '', innerHTML: '', addEventListener: jest.fn() };
});

document.createElement = jest.fn((tag) => {
  const element = {
    tagName: tag.toUpperCase(),
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    classList: { add: jest.fn(), remove: jest.fn() },
    appendChild: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    addEventListener: jest.fn(),
    getBoundingClientRect: jest.fn(() => ({ left: 0, top: 0, width: 100, height: 50 })),
  };
  return element;
});

document.querySelectorAll = jest.fn(() => []);
window.URL = { createObjectURL: jest.fn(), revokeObjectURL: jest.fn() };

// Execute the script
eval(matrixScript);

describe('Matrix UI Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.apiRequest.mockClear();
    global.showError.mockClear();
    global.showSuccess.mockClear();
  });

  describe('loadUsers', () => {
    test('should load users and populate filter', async () => {
      const mockUsers = [
        { id: 1, username: 'user1', role: 'user' },
        { id: 2, username: 'user2', role: 'admin' },
      ];
      global.apiRequest.mockResolvedValue(mockUsers);

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
    });
  });

  describe('loadMatrix', () => {
    test('should load matrix data successfully', async () => {
      const mockMatrixData = {
        dateRange: ['2025-12-01', '2025-12-02'],
        users: [
          { id: 1, username: 'user1', role: 'user' },
        ],
        data: {
          1: {
            '2025-12-01': {
              deskBookings: [{ id: 1, deskNumber: 'D001' }],
              parkingReservations: [],
            },
          },
        },
      };

      global.apiRequest.mockResolvedValue(mockMatrixData);
      document.getElementById('startDate').value = '2025-12-01';
      document.getElementById('endDate').value = '2025-12-02';

      await loadMatrix();

      expect(global.apiRequest).toHaveBeenCalledWith(
        expect.stringContaining('/api/matrix/bookings')
      );
    });

    test('should show error if dates are missing', async () => {
      document.getElementById('startDate').value = '';
      document.getElementById('endDate').value = '2025-12-02';

      await loadMatrix();

      expect(global.showError).toHaveBeenCalledWith(
        expect.stringContaining('start and end dates')
      );
    });

    test('should handle API errors', async () => {
      document.getElementById('startDate').value = '2025-12-01';
      document.getElementById('endDate').value = '2025-12-02';
      global.apiRequest.mockRejectedValue(new Error('API Error'));

      await loadMatrix();

      expect(global.showError).toHaveBeenCalled();
    });
  });

  describe('renderMatrix', () => {
    test('should render matrix table with data', () => {
      const matrixData = {
        dateRange: ['2025-12-01', '2025-12-02'],
        users: [
          { id: 1, username: 'user1', role: 'user' },
        ],
        data: {
          1: {
            '2025-12-01': {
              deskBookings: [{ id: 1, deskNumber: 'D001', startDate: '2025-12-01', endDate: '2025-12-01' }],
              parkingReservations: [],
            },
            '2025-12-02': {
              deskBookings: [],
              parkingReservations: [],
            },
          },
        },
      };

      renderMatrix(matrixData);

      expect(document.createElement).toHaveBeenCalledWith('table');
    });

    test('should show message if no data', () => {
      const matrixData = {
        dateRange: [],
        users: [],
        data: {},
      };

      renderMatrix(matrixData);

      const container = document.getElementById('matrix-container');
      expect(container.innerHTML).toContain('No data available');
    });
  });

  describe('exportMatrix', () => {
    test('should export matrix to CSV', () => {
      currentMatrixData = {
        dateRange: ['2025-12-01'],
        users: [
          { id: 1, username: 'user1', role: 'user' },
        ],
        data: {
          1: {
            '2025-12-01': {
              deskBookings: [{ id: 1, deskNumber: 'D001' }],
              parkingReservations: [],
            },
          },
        },
      };

      exportMatrix();

      expect(document.createElement).toHaveBeenCalledWith('a');
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

  describe('showTooltip', () => {
    test('should display tooltip with booking information', () => {
      const cellData = {
        deskBookings: [
          { id: 1, deskNumber: 'D001', startDate: '2025-12-01', endDate: '2025-12-01' },
        ],
        parkingReservations: [
          { id: 1, spaceNumber: 'P001', timePeriod: 'morning', reservationDate: '2025-12-01' },
        ],
      };
      const date = '2025-12-01';
      const user = { username: 'user1' };
      const event = {
        target: {
          getBoundingClientRect: () => ({ left: 100, top: 200, width: 50, height: 30 }),
        },
      };

      showTooltip(event, cellData, date, user);

      const tooltip = document.getElementById('matrix-tooltip');
      expect(tooltip.classList.add).toHaveBeenCalledWith('show');
      expect(tooltip.innerHTML).toContain('user1');
      expect(tooltip.innerHTML).toContain('D001');
      expect(tooltip.innerHTML).toContain('P001');
    });
  });

  describe('hideTooltip', () => {
    test('should hide tooltip', () => {
      hideTooltip();

      const tooltip = document.getElementById('matrix-tooltip');
      expect(tooltip.classList.remove).toHaveBeenCalledWith('show');
    });
  });
});

