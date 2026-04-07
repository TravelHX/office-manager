// Login functionality tests

function setWindowLocation(overrides = {}) {
  delete window.location;
  window.location = {
    href: overrides.href ?? '',
    search: overrides.search ?? '',
    pathname: overrides.pathname ?? '',
  };
}

describe('Login Functionality', () => {
  let savedDomContentLoadedHandler;
  let origDocumentAddEventListener;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    global.fetch = jest.fn();
    document.body.innerHTML = '';
    setWindowLocation();
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
    jest.clearAllMocks();
    localStorage.clear();
  });

  function loadLoginPage() {
    require('../js/login.js');
    if (savedDomContentLoadedHandler) {
      savedDomContentLoadedHandler.call(document, new Event('DOMContentLoaded'));
    }
  }

  function stubCheckUsersAndLogin(loginResponseFactory) {
    global.fetch.mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/auth/check-users')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ hasUsers: true }),
        });
      }
      if (u.includes('/api/auth/login')) {
        return Promise.resolve(loginResponseFactory());
      }
      return Promise.reject(new Error(`Unexpected fetch in login test: ${u}`));
    });
  }

  describe('Login Form Submission', () => {
    it('should submit login form with username and password', async () => {
      stubCheckUsersAndLogin(() => ({
        ok: true,
        json: async () => ({
          token: 'test-token-123',
          user: {
            id: 1,
            username: 'admin',
            role: 'admin',
          },
        }),
      }));

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="admin">
          <input type="password" id="password" name="password" value="Password123">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      loadLoginPage();
      await new Promise((r) => setTimeout(r, 50));

      document.getElementById('login-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await new Promise((r) => setTimeout(r, 80));

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
      stubCheckUsersAndLogin(() => ({
        ok: false,
        json: async () => ({
          error: {
            message: 'Invalid username or password',
            code: 'INVALID_CREDENTIALS',
          },
        }),
      }));

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="wronguser">
          <input type="password" id="password" name="password" value="wrongpass">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      loadLoginPage();
      await new Promise((r) => setTimeout(r, 50));

      document.getElementById('login-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await new Promise((r) => setTimeout(r, 80));

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

      stubCheckUsersAndLogin(() => ({
        ok: true,
        json: async () => ({
          token: 'test-token-123',
          user: mockUser,
        }),
      }));

      setWindowLocation();

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="admin">
          <input type="password" id="password" name="password" value="Password123">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      loadLoginPage();
      await new Promise((r) => setTimeout(r, 50));

      document.getElementById('login-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await new Promise((r) => setTimeout(r, 1500));

      expect(localStorage.getItem('authToken')).toBe('test-token-123');
      expect(JSON.parse(localStorage.getItem('user'))).toEqual(mockUser);
    });

    it('should redirect to home if already logged in', async () => {
      localStorage.setItem('authToken', 'existing-token');

      setWindowLocation();

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username">
          <input type="password" id="password" name="password">
          <button type="submit" id="login-button">Login</button>
        </form>
      `;

      loadLoginPage();
      await new Promise((r) => setTimeout(r, 30));

      expect(window.location.href).toBe('/');
    });

    it('should show PROFILE_SETUP_REQUIRED message without storing session (Bug 0013)', async () => {
      stubCheckUsersAndLogin(() => ({
        ok: false,
        json: async () => ({
          error: {
            code: 'PROFILE_SETUP_REQUIRED',
            message: 'Use the profile setup link from your invitation email.',
          },
        }),
      }));

      setWindowLocation({ search: '' });

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="new@example.com">
          <input type="password" id="password" name="password" value="x">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      loadLoginPage();
      await new Promise((r) => setTimeout(r, 50));

      document.getElementById('login-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await new Promise((r) => setTimeout(r, 80));

      const errorDiv = document.getElementById('login-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('profile setup link');
      expect(localStorage.getItem('authToken')).toBeNull();
    });

    it('should not store session when API returns user with incomplete profile (Bug 0013)', async () => {
      stubCheckUsersAndLogin(() => ({
        ok: true,
        json: async () => ({
          token: 'should-not-store',
          user: {
            id: 1,
            username: 'u@test.com',
            role: 'user',
            profileComplete: false,
          },
        }),
      }));

      setWindowLocation({ search: '' });

      document.body.innerHTML = `
        <form id="login-form">
          <input type="text" id="username" name="username" value="u@test.com">
          <input type="password" id="password" name="password" value="pw">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      loadLoginPage();
      await new Promise((r) => setTimeout(r, 50));

      document.getElementById('login-form').dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );

      await new Promise((r) => setTimeout(r, 80));

      expect(localStorage.getItem('authToken')).toBeNull();
      const errorDiv = document.getElementById('login-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('invitation');
    });

    it('should show setup hint when setupPending=1 in URL (Bug 0013)', async () => {
      setWindowLocation({ search: '?setupPending=1' });

      document.body.innerHTML = `
        <div id="login-setup-hint" style="display: none;"></div>
        <form id="login-form">
          <input type="text" id="username" name="username">
          <input type="password" id="password" name="password">
          <button type="submit" id="login-button">Login</button>
          <div id="login-error" style="display: none;"></div>
          <div id="login-success" style="display: none;"></div>
        </form>
      `;

      global.fetch.mockImplementation((url) => {
        const u = String(url);
        if (u.includes('/api/auth/check-users')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ hasUsers: true }),
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${u}`));
      });

      loadLoginPage();
      await new Promise((r) => setTimeout(r, 80));

      const hint = document.getElementById('login-setup-hint');
      expect(hint.style.display).toBe('block');
      expect(hint.textContent).toContain('profile setup link');
    });
  });
});
