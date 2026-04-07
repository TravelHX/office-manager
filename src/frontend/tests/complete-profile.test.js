/**
 * @jest-environment jsdom
 */

describe('Complete profile page', () => {
  let addEventListenerSpy;

  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    delete window.location;
    window.location = {
      search: '',
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/pages/complete-profile.html',
    };
    document.body.innerHTML = '';

    const orig = Document.prototype.addEventListener.bind(document);
    addEventListenerSpy = jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'DOMContentLoaded') {
        return undefined;
      }
      return orig(type, listener, options);
    });
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    jest.clearAllMocks();
  });

  function mountPage() {
    document.body.innerHTML = `
      <p id="provision-email"></p>
      <div id="token-error" style="display: none;"></div>
      <form id="complete-profile-form" style="display: none;">
        <select id="officeLocation" required>
          <option value="">Select location...</option>
          <option value="London">London</option>
          <option value="Prague">Prague</option>
        </select>
        <input type="password" id="newPassword" />
        <input type="password" id="confirmPassword" />
        <button type="submit" id="submitBtn">Complete setup</button>
      </form>
      <div id="complete-message"></div>
    `;
  }

  it('shows error when token is missing', async () => {
    window.location.search = '';
    mountPage();
    const { runCompleteProfilePage } = require('../js/complete-profile.js');
    await runCompleteProfilePage();

    const err = document.getElementById('token-error');
    expect(err.style.display).toBe('block');
    expect(err.textContent).toContain('Missing setup token');
  });

  it('validates token and reveals form when valid', async () => {
    window.location.search = '?token=good-token';
    mountPage();
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ valid: true, email: 'u@example.com' }),
    });

    const { runCompleteProfilePage } = require('../js/complete-profile.js');
    await runCompleteProfilePage();

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/provision/validate?token='),
    );
    expect(document.getElementById('provision-email').textContent).toContain('u@example.com');
    expect(document.getElementById('complete-profile-form').style.display).toBe('block');
  });

  it('shows token error when validate returns invalid', async () => {
    window.location.search = '?token=bad';
    mountPage();
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ valid: false, reason: 'Expired' }),
    });

    const { runCompleteProfilePage } = require('../js/complete-profile.js');
    await runCompleteProfilePage();

    const err = document.getElementById('token-error');
    expect(err.style.display).toBe('block');
    expect(err.textContent).toBe('Expired');
  });

  it('shows error when passwords do not match on submit', async () => {
    window.location.search = '?token=t1';
    mountPage();
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ valid: true, email: 'u@example.com' }),
    });

    const { runCompleteProfilePage } = require('../js/complete-profile.js');
    await runCompleteProfilePage();

    document.getElementById('officeLocation').value = 'London';
    document.getElementById('newPassword').value = 'a';
    document.getElementById('confirmPassword').value = 'b';

    document.getElementById('complete-profile-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    expect(document.getElementById('complete-message').innerHTML).toContain(
      'Passwords do not match',
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('POSTs complete-profile and shows success on OK response', async () => {
    delete window.location;
    window.location = {
      search: '?token=tok-complete',
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000/pages/complete-profile.html?token=tok-complete',
    };
    mountPage();
    global.fetch
      .mockResolvedValueOnce({
        json: async () => ({ valid: true, email: 'u@example.com' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'session-after-setup',
          user: {
            id: 99,
            email: 'u@example.com',
            profileComplete: true,
            username: 'u@example.com',
          },
        }),
      });

    const { runCompleteProfilePage } = require('../js/complete-profile.js');
    await runCompleteProfilePage();

    document.getElementById('officeLocation').value = 'Prague';
    document.getElementById('newPassword').value = 'Secret123!';
    document.getElementById('confirmPassword').value = 'Secret123!';

    document.getElementById('complete-profile-form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );

    await new Promise((r) => setTimeout(r, 20));

    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/auth/complete-profile',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'tok-complete',
          password: 'Secret123!',
          office_location: 'Prague',
        }),
      }),
    );

    expect(document.getElementById('complete-message').innerHTML).toContain(
      'Profile complete',
    );
    expect(localStorage.getItem('authToken')).toBe('session-after-setup');
    expect(JSON.parse(localStorage.getItem('user')).profileComplete).toBe(true);
  });
});
