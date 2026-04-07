/**
 * @jest-environment jsdom
 */

const { updateUserIndicator } = require('../js/main.js');

describe('App shell and account menu', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/api/version')) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: async () => ({ versionNumber: '0.0.0-test' }),
        });
      }
      return Promise.resolve({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ hasUsers: true }),
      });
    });
    delete window.location;
    window.location = { pathname: '/pages/login.html', search: '', href: 'http://localhost/pages/login.html' };
    document.body.innerHTML = `
      <div id="account-menu-anchor"></div>
    `;
  });

  test('updateUserIndicator renders guest account menu with Log in link', () => {
    updateUserIndicator();
    const trigger = document.getElementById('account-menu-trigger');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toMatch(/Account/i);
    const panel = document.getElementById('account-menu-panel');
    expect(panel.querySelector('a[href*="login.html"]')).toBeTruthy();
  });

  test('updateUserIndicator renders user details and log out for authenticated user', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        email: 'u@example.com',
        firstName: 'Test',
        lastName: 'User',
        isAdmin: false,
        officeLocation: 'London',
      })
    );
    localStorage.setItem('authToken', 't1');
    updateUserIndicator();
    const panel = document.getElementById('account-menu-panel');
    expect(panel.textContent).toContain('u@example.com');
    expect(panel.textContent).toContain('London');
    expect(panel.querySelector('.account-logout-link')).toBeTruthy();
  });
});
