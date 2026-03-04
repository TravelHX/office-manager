/**
 * @jest-environment jsdom
 */

describe('Reset Password Functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    document.body.innerHTML = '';
    
    // Mock URLSearchParams
    delete window.location;
    window.location = {
      href: '',
      search: '',
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Reset Password Form Submission', () => {
    it('should submit reset password form with token and new password', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Password has been reset successfully',
        }),
      });

      document.body.innerHTML = `
        <form id="reset-password-form">
          <input type="text" id="token" name="token" value="test-token-123">
          <input type="password" id="newPassword" name="newPassword" value="newpassword123">
          <input type="password" id="confirmPassword" name="confirmPassword" value="newpassword123">
          <button type="submit" id="submit-button">Reset Password</button>
          <div id="reset-password-error" style="display: none;"></div>
          <div id="reset-password-success" style="display: none;"></div>
          <button type="button" id="password-toggle">
            <span id="password-toggle-text">Show</span>
          </button>
          <button type="button" id="confirm-password-toggle">
            <span id="confirm-password-toggle-text">Show</span>
          </button>
        </form>
      `;

      require('../js/reset-password.js');

      const form = document.getElementById('reset-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'test-token-123',
          newPassword: 'newpassword123',
        }),
      });
    });

    it('should extract token from URL query parameter', () => {
      window.location.search = '?token=url-token-456';

      document.body.innerHTML = `
        <form id="reset-password-form">
          <input type="text" id="token" name="token" value="">
          <input type="password" id="newPassword" name="newPassword">
          <input type="password" id="confirmPassword" name="confirmPassword">
          <button type="submit" id="submit-button">Reset Password</button>
          <div id="reset-password-error" style="display: none;"></div>
          <div id="reset-password-success" style="display: none;"></div>
          <button type="button" id="password-toggle">
            <span id="password-toggle-text">Show</span>
          </button>
          <button type="button" id="confirm-password-toggle">
            <span id="confirm-password-toggle-text">Show</span>
          </button>
        </form>
      `;

      // Mock URLSearchParams
      const originalURLSearchParams = global.URLSearchParams;
      global.URLSearchParams = jest.fn((search) => {
        const params = new originalURLSearchParams(search);
        return {
          get: (key) => key === 'token' ? 'url-token-456' : null,
        };
      });

      require('../js/reset-password.js');

      const tokenInput = document.getElementById('token');
      expect(tokenInput.value).toBe('url-token-456');
    });

    it('should display error when token is empty', async () => {
      document.body.innerHTML = `
        <form id="reset-password-form">
          <input type="text" id="token" name="token" value="">
          <input type="password" id="newPassword" name="newPassword" value="newpassword123">
          <input type="password" id="confirmPassword" name="confirmPassword" value="newpassword123">
          <button type="submit" id="submit-button">Reset Password</button>
          <div id="reset-password-error" style="display: none;"></div>
          <div id="reset-password-success" style="display: none;"></div>
          <button type="button" id="password-toggle">
            <span id="password-toggle-text">Show</span>
          </button>
          <button type="button" id="confirm-password-toggle">
            <span id="confirm-password-toggle-text">Show</span>
          </button>
        </form>
      `;

      require('../js/reset-password.js');

      const form = document.getElementById('reset-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorDiv = document.getElementById('reset-password-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('Reset token is required');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should display error when password is too short', async () => {
      document.body.innerHTML = `
        <form id="reset-password-form">
          <input type="text" id="token" name="token" value="test-token">
          <input type="password" id="newPassword" name="newPassword" value="12345">
          <input type="password" id="confirmPassword" name="confirmPassword" value="12345">
          <button type="submit" id="submit-button">Reset Password</button>
          <div id="reset-password-error" style="display: none;"></div>
          <div id="reset-password-success" style="display: none;"></div>
          <button type="button" id="password-toggle">
            <span id="password-toggle-text">Show</span>
          </button>
          <button type="button" id="confirm-password-toggle">
            <span id="confirm-password-toggle-text">Show</span>
          </button>
        </form>
      `;

      require('../js/reset-password.js');

      const form = document.getElementById('reset-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorDiv = document.getElementById('reset-password-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('at least 6 characters');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should display error when passwords do not match', async () => {
      document.body.innerHTML = `
        <form id="reset-password-form">
          <input type="text" id="token" name="token" value="test-token">
          <input type="password" id="newPassword" name="newPassword" value="newpassword123">
          <input type="password" id="confirmPassword" name="confirmPassword" value="differentpassword">
          <button type="submit" id="submit-button">Reset Password</button>
          <div id="reset-password-error" style="display: none;"></div>
          <div id="reset-password-success" style="display: none;"></div>
          <button type="button" id="password-toggle">
            <span id="password-toggle-text">Show</span>
          </button>
          <button type="button" id="confirm-password-toggle">
            <span id="confirm-password-toggle-text">Show</span>
          </button>
        </form>
      `;

      require('../js/reset-password.js');

      const form = document.getElementById('reset-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorDiv = document.getElementById('reset-password-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('Passwords do not match');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should display success message and redirect to login on success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'Password has been reset successfully',
        }),
      });

      delete window.location;
      window.location = { href: '', search: '' };

      document.body.innerHTML = `
        <form id="reset-password-form">
          <input type="text" id="token" name="token" value="test-token">
          <input type="password" id="newPassword" name="newPassword" value="newpassword123">
          <input type="password" id="confirmPassword" name="confirmPassword" value="newpassword123">
          <button type="submit" id="submit-button">Reset Password</button>
          <div id="reset-password-error" style="display: none;"></div>
          <div id="reset-password-success" style="display: none;"></div>
          <button type="button" id="password-toggle">
            <span id="password-toggle-text">Show</span>
          </button>
          <button type="button" id="confirm-password-toggle">
            <span id="confirm-password-toggle-text">Show</span>
          </button>
        </form>
      `;

      require('../js/reset-password.js');

      const form = document.getElementById('reset-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const successDiv = document.getElementById('reset-password-success');
      expect(successDiv.style.display).toBe('block');
      expect(successDiv.textContent).toContain('reset successfully');

      // Check that form fields are cleared
      expect(document.getElementById('token').value).toBe('');
      expect(document.getElementById('newPassword').value).toBe('');
      expect(document.getElementById('confirmPassword').value).toBe('');
    });

    it('should toggle password visibility', () => {
      document.body.innerHTML = `
        <form id="reset-password-form">
          <input type="password" id="newPassword" name="newPassword" value="password123">
          <input type="password" id="confirmPassword" name="confirmPassword" value="password123">
          <button type="button" id="password-toggle">
            <span id="password-toggle-text">Show</span>
          </button>
          <button type="button" id="confirm-password-toggle">
            <span id="confirm-password-toggle-text">Show</span>
          </button>
        </form>
      `;

      require('../js/reset-password.js');

      const passwordInput = document.getElementById('newPassword');
      const passwordToggle = document.getElementById('password-toggle');
      const passwordToggleText = document.getElementById('password-toggle-text');

      expect(passwordInput.type).toBe('password');
      expect(passwordToggleText.textContent).toBe('Show');

      passwordToggle.click();

      expect(passwordInput.type).toBe('text');
      expect(passwordToggleText.textContent).toBe('Hide');

      passwordToggle.click();

      expect(passwordInput.type).toBe('password');
      expect(passwordToggleText.textContent).toBe('Show');
    });
  });
});
