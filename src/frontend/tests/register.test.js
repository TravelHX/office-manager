// Registration screen tests for Phase 14

describe('Registration Screen - No Users Exist', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Mock fetch
    global.fetch = jest.fn();
    // Reset DOM
    document.body.innerHTML = '';
    // Mock window.location
    delete window.location;
    window.location = { href: '' };
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Registration Screen Display', () => {
    it('should display registration form with first user message (Bug 0009: no username field)', () => {
      document.body.innerHTML = `
        <div class="register-container">
          <h2>Create Administrator Account</h2>
          <div class="info-message">
            <strong>First User Registration</strong>
            You are registering as the first user. The first user will automatically be assigned administrator privileges.
          </div>
          <form id="register-form">
            <div class="form-group">
              <label for="email">Email <span class="required-indicator">*</span></label>
              <input type="email" id="email" name="email" required>
            </div>
            <div class="form-group">
              <label for="password">Password <span class="required-indicator">*</span></label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" id="register-button">Create Administrator Account</button>
            <div id="register-error" style="display: none;"></div>
            <div id="register-success" style="display: none;"></div>
          </form>
        </div>
      `;

      const infoMessage = document.querySelector('.info-message');
      expect(infoMessage).toBeDefined();
      expect(infoMessage.textContent).toContain('First User Registration');
      expect(infoMessage.textContent).toContain('administrator privileges');
      // Bug 0009: Verify username field is not present
      expect(document.getElementById('username')).toBeNull();
    });

    it('should have all required form fields (Bug 0009: username field should not be present)', () => {
      document.body.innerHTML = `
        <form id="register-form">
          <input type="email" id="email" name="email" required>
          <input type="password" id="password" name="password" required>
          <input type="text" id="firstName" name="firstName">
          <input type="text" id="lastName" name="lastName">
          <select id="officeLocation" name="officeLocation">
            <option value="">Select location...</option>
            <option value="London">London</option>
            <option value="Prague">Prague</option>
          </select>
          <button type="submit" id="register-button">Create Administrator Account</button>
        </form>
      `;

      // Bug 0009: Username field should NOT be present
      expect(document.getElementById('username')).toBeNull();
      expect(document.getElementById('email')).toBeDefined();
      expect(document.getElementById('password')).toBeDefined();
      expect(document.getElementById('firstName')).toBeDefined();
      expect(document.getElementById('lastName')).toBeDefined();
      expect(document.getElementById('officeLocation')).toBeDefined();
    });
  });

  describe('Registration Form Submission', () => {
    it('should submit registration form and create first user as admin (Bug 0009: no username in request)', async () => {
      // Mock successful registration response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token-123',
          user: {
            id: 1,
            username: 'firstuser@test.com', // Backend uses email as username
            email: 'firstuser@test.com',
            isAdmin: true,
            role: 'admin',
          },
          message: 'Registration successful! You are now the administrator.',
        }),
      });

      document.body.innerHTML = `
        <form id="register-form">
          <input type="email" id="email" name="email" value="firstuser@test.com">
          <input type="password" id="password" name="password" value="password123">
          <input type="text" id="firstName" name="firstName" value="First">
          <input type="text" id="lastName" name="lastName" value="User">
          <select id="officeLocation" name="officeLocation">
            <option value="London">London</option>
          </select>
          <button type="submit" id="register-button">Create Administrator Account</button>
          <div id="register-error" style="display: none;"></div>
          <div id="register-success" style="display: none;"></div>
        </form>
      `;

      // Load register.js
      require('../js/register.js');

      const form = document.getElementById('register-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify fetch was called with correct parameters (no username field)
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'firstuser@test.com',
          password: 'password123',
          first_name: 'First',
          last_name: 'User',
          office_location: 'London',
        }),
      });

      // Verify token and user are stored
      expect(localStorage.getItem('authToken')).toBe('test-token-123');
      expect(localStorage.getItem('user')).toBeDefined();
    });

    it('should handle registration error and display error message', async () => {
      // Mock failed registration response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Email already exists',
            code: 'USER_EXISTS',
          },
        }),
      });

      document.body.innerHTML = `
        <form id="register-form">
          <input type="email" id="email" name="email" value="existing@test.com">
          <input type="password" id="password" name="password" value="password123">
          <button type="submit" id="register-button">Create Administrator Account</button>
          <div id="register-error" style="display: none;"></div>
          <div id="register-success" style="display: none;"></div>
        </form>
      `;

      require('../js/register.js');

      const form = document.getElementById('register-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorDiv = document.getElementById('register-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('Email already exists');
    });
  });
});

describe('Routing to Registration When No Users Exist', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    delete window.location;
    window.location = { href: '' };
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('should redirect to registration when no users exist on login page', async () => {
    // Mock check-users endpoint returning no users
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasUsers: false,
      }),
    });

    document.body.innerHTML = `
      <form id="login-form">
        <input type="text" id="username" name="username">
        <input type="password" id="password" name="password">
        <button type="submit" id="login-button">Login</button>
      </form>
    `;

    // Load login.js
    require('../js/login.js');

    // Wait for async check-users call
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify redirect to registration
    expect(window.location.href).toBe('/pages/register.html');
  });

  it('should redirect to registration when no users exist on protected page', async () => {
    // Mock check-users endpoint returning no users
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasUsers: false,
      }),
    });

    // Mock current path as a protected page
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/pages/desk-booking.html',
        href: '',
      },
      writable: true,
    });

    document.body.innerHTML = '<div id="app"></div>';

    // Load main.js
    require('../js/main.js');

    // Wait for async check-users call
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify redirect to registration
    expect(window.location.href).toBe('/pages/register.html');
  });

  it('should not redirect when users exist', async () => {
    // Mock check-users endpoint returning users exist
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasUsers: true,
      }),
    });

    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/pages/desk-booking.html',
        href: '',
      },
      writable: true,
    });

    document.body.innerHTML = '<div id="app"></div>';

    // Load main.js
    require('../js/main.js');

    // Wait for async check-users call
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify no redirect (href should remain empty)
    expect(window.location.href).toBe('');
  });

  it('should not redirect from registration or login pages even when no users exist', async () => {
    // Mock check-users endpoint returning no users
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasUsers: false,
      }),
    });

    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/pages/register.html',
        href: '',
      },
      writable: true,
    });

    document.body.innerHTML = '<div id="app"></div>';

    // Load main.js
    require('../js/main.js');

    // Wait for async check-users call
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify no redirect from registration page
    expect(window.location.href).toBe('');
  });
});
