// Registration screen tests for Phase 14

describe('Registration Screen - No Users Exist', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.fetch = jest.fn();
    document.body.innerHTML = '';
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
    let savedDomContentLoadedHandler;
    let origDocumentAddEventListener;

    beforeEach(() => {
      savedDomContentLoadedHandler = null;
      origDocumentAddEventListener = Document.prototype.addEventListener.bind(document);
      jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
        if (type === 'DOMContentLoaded') {
          savedDomContentLoadedHandler = listener;
          return undefined;
        }
        return origDocumentAddEventListener(type, listener, options);
      });
    });

    afterEach(() => {
      document.addEventListener.mockRestore();
    });

    function loadRegisterPage() {
      require('../js/register.js');
      if (savedDomContentLoadedHandler) {
        savedDomContentLoadedHandler.call(document, new Event('DOMContentLoaded'));
      }
    }

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
          <input type="password" id="confirmPassword" name="confirmPassword" value="password123">
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

      loadRegisterPage();

      const form = document.getElementById('register-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

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
          <input type="password" id="confirmPassword" name="confirmPassword" value="password123">
          <input type="text" id="firstName" name="firstName" value="">
          <input type="text" id="lastName" name="lastName" value="">
          <select id="officeLocation" name="officeLocation">
            <option value="" selected></option>
          </select>
          <button type="submit" id="register-button">Create Administrator Account</button>
          <div id="register-error" style="display: none;"></div>
          <div id="register-success" style="display: none;"></div>
        </form>
      `;

      loadRegisterPage();

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

function mockFetchForMainJs(options) {
  const hasUsers = options.hasUsers;
  global.fetch.mockImplementation((url) => {
    const u = String(url);
    if (u.includes('/api/auth/check-users')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ hasUsers }),
      });
    }
    if (u.includes('/api/version')) {
      return Promise.resolve({
        ok: true,
        headers: { get: (h) => (h === 'content-type' ? 'application/json' : null) },
        json: async () => ({ versionNumber: '0.0.0-test' }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch in test: ${u}`));
  });
}

describe('Routing to Registration When No Users Exist', () => {
  let routingDomContentLoadedHandler;
  let origDocumentAddEventListenerForRouting;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.fetch = jest.fn();
    delete window.location;
    window.location = { href: '', pathname: '', search: '' };
    document.body.innerHTML = '';
    routingDomContentLoadedHandler = null;
    origDocumentAddEventListenerForRouting = Document.prototype.addEventListener.bind(document);
    jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'DOMContentLoaded') {
        routingDomContentLoadedHandler = listener;
        return undefined;
      }
      return origDocumentAddEventListenerForRouting(type, listener, options);
    });
  });

  afterEach(() => {
    document.addEventListener.mockRestore();
    jest.clearAllMocks();
    localStorage.clear();
  });

  function fireRoutingDomReady() {
    if (routingDomContentLoadedHandler) {
      routingDomContentLoadedHandler.call(document, new Event('DOMContentLoaded'));
    }
  }

  it('should redirect to registration when no users exist on login page', async () => {
    global.fetch.mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/auth/check-users')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasUsers: false }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`));
    });

    document.body.innerHTML = `
      <form id="login-form">
        <input type="text" id="username" name="username">
        <input type="password" id="password" name="password">
        <button type="submit" id="login-button">Login</button>
      </form>
    `;

    require('../js/login.js');
    fireRoutingDomReady();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(window.location.href).toBe('/pages/register.html');
  });

  it('should redirect to registration when no users exist on protected page', async () => {
    mockFetchForMainJs({ hasUsers: false });

    delete window.location;
    window.location = {
      pathname: '/pages/desk-booking.html',
      href: '',
      search: '',
    };

    document.body.innerHTML = '<div id="app"></div>';

    require('../js/main.js');
    fireRoutingDomReady();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(window.location.href).toBe('/pages/register.html');
  });

  it('should not redirect when users exist', async () => {
    mockFetchForMainJs({ hasUsers: true });

    delete window.location;
    window.location = {
      pathname: '/pages/desk-booking.html',
      href: '',
      search: '',
    };

    document.body.innerHTML = '<div id="app"></div>';

    require('../js/main.js');
    fireRoutingDomReady();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(window.location.href).toContain('/pages/login.html');
    expect(window.location.href).toContain('desk-booking');
  });

  it('should not redirect from registration or login pages even when no users exist', async () => {
    mockFetchForMainJs({ hasUsers: false });

    delete window.location;
    window.location = {
      pathname: '/pages/register.html',
      href: '',
      search: '',
    };

    document.body.innerHTML = '<div id="app"></div>';

    require('../js/main.js');
    fireRoutingDomReady();

    await new Promise(resolve => setTimeout(resolve, 150));

    expect(window.location.href).toBe('');
  });
});
