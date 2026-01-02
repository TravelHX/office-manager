// Login functionality tests

describe('Login Functionality', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Mock fetch
    global.fetch = jest.fn();
    // Reset DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Login Form Submission', () => {
    it('should submit login form with username and password', async () => {
      // Mock successful login response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token-123',
          user: {
            id: 1,
            username: 'admin',
            role: 'admin',
          },
        }),
      });

      // Create login form HTML
      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="admin">
          <input type="password" id="password" name="password" value="Password123">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      // Load login.js
      require('../js/login.js');

      // Simulate form submission
      const form = document.getElementById('login-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'Password123',
        }),
      });
    });

    it('should handle login error and display error message', async () => {
      // Mock failed login response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Invalid username or password',
            code: 'INVALID_CREDENTIALS',
          },
        }),
      });

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="wronguser">
          <input type="password" id="password" name="password" value="wrongpass">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      require('../js/login.js');

      const form = document.getElementById('login-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorDiv = document.getElementById('login-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('Invalid username or password');
    });

    it('should store token and user in localStorage on successful login', async () => {
      const mockUser = {
        id: 1,
        username: 'admin',
        role: 'admin',
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token-123',
          user: mockUser,
        }),
      });

      // Mock window.location.href
      delete window.location;
      window.location = { href: '' };

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="admin">
          <input type="password" id="password" name="password" value="Password123">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      require('../js/login.js');

      const form = document.getElementById('login-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 1500));

      expect(localStorage.getItem('authToken')).toBe('test-token-123');
      expect(JSON.parse(localStorage.getItem('user'))).toEqual(mockUser);
    });

    it('should redirect to home if already logged in', () => {
      localStorage.setItem('authToken', 'existing-token');

      delete window.location;
      window.location = { href: '' };

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username">
          <input type="password" id="password" name="password">
          <button type="submit" id="login-button">Login</button>
        </form>
      `;

      require('../js/login.js');

      expect(window.location.href).toBe('/');
    });
  });
});

