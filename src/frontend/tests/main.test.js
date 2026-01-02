/**
 * @jest-environment jsdom
 */

// Mock fetch before loading main.js
global.fetch = jest.fn();

// Setup before tests
beforeAll(() => {
  // Load main.js and make functions available
  require('../js/main.js');
  
  // Make functions available on window for testing
  // Note: getAuthToken is already available globally from main.js
});

describe('Main JavaScript Functions', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch.mockClear();
    document.body.innerHTML = '<div class="container"></div>';
  });

  describe('getAuthToken', () => {
    beforeEach(() => {
      // Mock window.location
      delete window.location;
      window.location = { pathname: '/' };
    });

    test('should create token if not exists', () => {
      localStorage.clear();
      
      const token = getAuthToken();
      
      expect(token).toBeTruthy();
      expect(token).toMatch(/^user_/);
      expect(token).toBe('user_1'); // Should use userId = 1 for development
    });

    test('should return existing token', () => {
      const existingToken = 'user_1234567890';
      localStorage.setItem('auth_token', existingToken);
      
      const token = getAuthToken();
      
      expect(token).toBe(existingToken);
    });

    test('should return admin token when on admin page', () => {
      localStorage.clear();
      window.location.pathname = '/pages/admin.html';
      
      const token = getAuthToken();
      
      expect(token).toBeTruthy();
      expect(token).toMatch(/^admin_/);
      expect(token).toBe('admin_1'); // Should use userId = 1 for development
    });

    test('should return admin token when URL contains admin', () => {
      localStorage.clear();
      window.location.pathname = '/admin';
      
      const token = getAuthToken();
      
      expect(token).toBeTruthy();
      expect(token).toMatch(/^admin_/);
    });

    test('should return user token when not on admin page', () => {
      localStorage.clear();
      window.location.pathname = '/pages/desk-booking.html';
      
      const token = getAuthToken();
      
      expect(token).toBeTruthy();
      expect(token).toMatch(/^user_/);
      expect(token).toBe('user_1'); // Should use userId = 1 for development
    });
  });

  describe('apiRequest', () => {
    beforeEach(() => {
      // Mock window.location
      delete window.location;
      window.location = { pathname: '/' };
    });

    test('should make GET request with auth header', async () => {
      const mockResponse = { data: 'test' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      
      localStorage.setItem('auth_token', 'user_123');
      
      const result = await apiRequest('/test');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer user_123',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    test('should make POST request with body', async () => {
      const mockResponse = { success: true };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      
      const body = { deskId: 1, startDate: '2025-12-15', endDate: '2025-12-16' };
      
      await apiRequest('/bookings', {
        method: 'POST',
        body: body,
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/bookings',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    test('should throw error on failed request', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: 'Not found' } }),
      });
      
      await expect(apiRequest('/test')).rejects.toThrow();
    });

    test('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      await expect(apiRequest('/test')).rejects.toThrow('Network error');
    });

    test('should use admin token when on admin page', async () => {
      window.location.pathname = '/pages/admin.html';
      localStorage.clear();
      
      const mockResponse = { deskCount: 10, parkingCount: 5 };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      
      await apiRequest('/api/admin/configuration');
      
      const callArgs = global.fetch.mock.calls[0];
      const authHeader = callArgs[1].headers.Authorization;
      
      expect(authHeader).toMatch(/^Bearer admin_/);
    });
  });

  describe('showError', () => {
    test('should display error message', () => {
      showError('Test error message');
      
      const errorDiv = document.querySelector('.error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toBe('Test error message');
    });

    test('should remove error after timeout', (done) => {
      jest.useFakeTimers();
      
      showError('Test error');
      
      const errorDiv = document.querySelector('.error');
      expect(errorDiv).toBeTruthy();
      
      jest.advanceTimersByTime(5000);
      
      setTimeout(() => {
        expect(document.querySelector('.error')).toBeNull();
        done();
      }, 100);
      
      jest.useRealTimers();
    });
  });

  describe('showSuccess', () => {
    test('should display success message', () => {
      showSuccess('Test success message');
      
      const successDiv = document.querySelector('.success');
      expect(successDiv).toBeTruthy();
      expect(successDiv.textContent).toBe('Test success message');
    });

    test('should remove success after timeout', (done) => {
      jest.useFakeTimers();
      
      showSuccess('Test success');
      
      const successDiv = document.querySelector('.success');
      expect(successDiv).toBeTruthy();
      
      jest.advanceTimersByTime(5000);
      
      setTimeout(() => {
        expect(document.querySelector('.success')).toBeNull();
        done();
      }, 100);
      
      jest.useRealTimers();
    });
  });
});

