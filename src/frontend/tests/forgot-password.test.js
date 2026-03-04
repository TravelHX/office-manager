/**
 * @jest-environment jsdom
 */

describe('Forgot Password Functionality', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('Forgot Password Form Submission', () => {
    it('should submit forgot password form with email', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
      });

      document.body.innerHTML = `
        <form id="forgot-password-form">
          <input type="email" id="email" name="email" value="user@example.com">
          <button type="submit" id="submit-button">Send Reset Link</button>
          <div id="forgot-password-error" style="display: none;"></div>
          <div id="forgot-password-success" style="display: none;"></div>
        </form>
      `;

      require('../js/forgot-password.js');

      const form = document.getElementById('forgot-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'user@example.com' }),
      });
    });

    it('should display error message when email is empty', async () => {
      document.body.innerHTML = `
        <form id="forgot-password-form">
          <input type="email" id="email" name="email" value="">
          <button type="submit" id="submit-button">Send Reset Link</button>
          <div id="forgot-password-error" style="display: none;"></div>
          <div id="forgot-password-success" style="display: none;"></div>
        </form>
      `;

      require('../js/forgot-password.js');

      const form = document.getElementById('forgot-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorDiv = document.getElementById('forgot-password-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('Please enter your email address');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should display success message on successful submission', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
      });

      document.body.innerHTML = `
        <form id="forgot-password-form">
          <input type="email" id="email" name="email" value="user@example.com">
          <button type="submit" id="submit-button">Send Reset Link</button>
          <div id="forgot-password-error" style="display: none;"></div>
          <div id="forgot-password-success" style="display: none;"></div>
        </form>
      `;

      require('../js/forgot-password.js');

      const form = document.getElementById('forgot-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const successDiv = document.getElementById('forgot-password-success');
      expect(successDiv.style.display).toBe('block');
      expect(successDiv.textContent).toContain('password reset link has been sent');
    });

    it('should handle API error and display error message', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Invalid email format',
            code: 'VALIDATION_ERROR',
          },
        }),
      });

      document.body.innerHTML = `
        <form id="forgot-password-form">
          <input type="email" id="email" name="email" value="invalid-email">
          <button type="submit" id="submit-button">Send Reset Link</button>
          <div id="forgot-password-error" style="display: none;"></div>
          <div id="forgot-password-success" style="display: none;"></div>
        </form>
      `;

      require('../js/forgot-password.js');

      const form = document.getElementById('forgot-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      const errorDiv = document.getElementById('forgot-password-error');
      expect(errorDiv.style.display).toBe('block');
      expect(errorDiv.textContent).toContain('Invalid email format');
    });

    it('should disable submit button during submission', async () => {
      global.fetch.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ message: 'Success' }),
      }), 50)));

      document.body.innerHTML = `
        <form id="forgot-password-form">
          <input type="email" id="email" name="email" value="user@example.com">
          <button type="submit" id="submit-button">Send Reset Link</button>
          <div id="forgot-password-error" style="display: none;"></div>
          <div id="forgot-password-success" style="display: none;"></div>
        </form>
      `;

      require('../js/forgot-password.js');

      const submitButton = document.getElementById('submit-button');
      const form = document.getElementById('forgot-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      expect(submitButton.disabled).toBe(true);
      expect(submitButton.textContent).toBe('Sending...');

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(submitButton.disabled).toBe(false);
      expect(submitButton.textContent).toBe('Send Reset Link');
    });

    it('should clear email field after successful submission', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: 'If an account with that email exists, a password reset link has been sent.',
        }),
      });

      document.body.innerHTML = `
        <form id="forgot-password-form">
          <input type="email" id="email" name="email" value="user@example.com">
          <button type="submit" id="submit-button">Send Reset Link</button>
          <div id="forgot-password-error" style="display: none;"></div>
          <div id="forgot-password-success" style="display: none;"></div>
        </form>
      `;

      require('../js/forgot-password.js');

      const emailInput = document.getElementById('email');
      const form = document.getElementById('forgot-password-form');
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(emailInput.value).toBe('');
    });
  });
});
