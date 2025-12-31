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
  window.getAuthToken = () => {
    let token = localStorage.getItem('auth_token');
    if (!token) {
      token = 'user_' + Date.now();
      localStorage.setItem('auth_token', token);
    }
    return token;
  };
});

describe('Main JavaScript Functions', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch.mockClear();
    document.body.innerHTML = '<div class="container"></div>';
  });

  describe('getAuthToken', () => {
    test('should create token if not exists', () => {
      localStorage.getItem.mockReturnValue(null);
      
      const token = window.getAuthToken();
      
      expect(token).toBeTruthy();
      expect(token).toMatch(/^user_/);
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    test('should return existing token', () => {
      const existingToken = 'user_1234567890';
      localStorage.getItem.mockReturnValue(existingToken);
      
      const token = window.getAuthToken();
      
      expect(token).toBe(existingToken);
    });
  });

  describe('apiRequest', () => {
    test('should make GET request with auth header', async () => {
      const mockResponse = { data: 'test' };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      
      localStorage.getItem.mockReturnValue('user_123');
      
      const result = await window.apiRequest('/test');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/test',
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
      
      await window.apiRequest('/bookings', {
        method: 'POST',
        body: body,
      });
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/bookings',
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
      
      await expect(window.apiRequest('/test')).rejects.toThrow();
    });

    test('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));
      
      await expect(window.apiRequest('/test')).rejects.toThrow('Network error');
    });
  });

  describe('showError', () => {
    test('should display error message', () => {
      window.showError('Test error message');
      
      const errorDiv = document.querySelector('.error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toBe('Test error message');
    });

    test('should remove error after timeout', (done) => {
      jest.useFakeTimers();
      
      window.showError('Test error');
      
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
      window.showSuccess('Test success message');
      
      const successDiv = document.querySelector('.success');
      expect(successDiv).toBeTruthy();
      expect(successDiv.textContent).toBe('Test success message');
    });

    test('should remove success after timeout', (done) => {
      jest.useFakeTimers();
      
      window.showSuccess('Test success');
      
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

