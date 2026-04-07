/**
 * @jest-environment jsdom
 */

let main;

beforeAll(() => {
  global.fetch = jest.fn();
  main = require('../js/main.js');
});

describe('Main JavaScript (current behavior)', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch.mockClear();
    document.body.innerHTML = '<div class="container"></div>';
  });

  describe('getAuthToken / setAuthToken', () => {
    test('returns null when no token stored', () => {
      expect(main.getAuthToken()).toBeNull();
    });

    test('returns stored authToken from localStorage', () => {
      localStorage.setItem('authToken', 'user_abc');
      expect(main.getAuthToken()).toBe('user_abc');
    });
  });

  describe('apiRequest', () => {
    test('makes GET with Bearer token when authToken set', async () => {
      localStorage.setItem('authToken', 'tok_1');
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (h) => (h === 'content-type' ? 'application/json' : null),
        },
        text: async () => '{"ok":true}',
      });

      const result = await main.apiRequest('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer tok_1',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual({ ok: true });
    });

    test('returns null on 204', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 204,
        headers: { get: () => null },
        text: async () => '',
      });

      const result = await main.apiRequest('/api/x', { method: 'DELETE' });
      expect(result).toBeNull();
    });

    test('throws on failed response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: {
          get: (h) => (h === 'content-type' ? 'application/json' : null),
        },
        text: async () => JSON.stringify({ error: { message: 'Bad' } }),
      });

      await expect(main.apiRequest('/api/x')).rejects.toThrow('Bad');
    });
  });

  describe('isAdmin (Bug 0012)', () => {
    test('returns true when user has role admin', () => {
      localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
      expect(main.isAdmin()).toBe(true);
    });

    test('returns true when user has is_admin flag from API shape', () => {
      localStorage.setItem('user', JSON.stringify({ is_admin: 1 }));
      expect(main.isAdmin()).toBe(true);
    });

    test('returns false when isAdmin is truthy string (avoid loose truthiness)', () => {
      localStorage.setItem('user', JSON.stringify({ isAdmin: '0' }));
      expect(main.isAdmin()).toBe(false);
    });

    test('returns true for role admin case-insensitive', () => {
      localStorage.setItem('user', JSON.stringify({ role: ' Admin ' }));
      expect(main.isAdmin()).toBe(true);
    });

    test('returns true when isAdmin is numeric string 1 from driver', () => {
      localStorage.setItem('user', JSON.stringify({ isAdmin: '1' }));
      expect(main.isAdmin()).toBe(true);
    });
  });

  describe('syncCurrentUserFromServer (admin menu / Bug 0012)', () => {
    test('no-ops when no auth token', async () => {
      const out = await main.syncCurrentUserFromServer();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(out).toBeNull();
    });

    test('updates localStorage user when /me succeeds', async () => {
      localStorage.setItem('authToken', 'jwt-1');
      localStorage.setItem('user', JSON.stringify({ id: 1, role: 'user' }));

      const payload = {
        id: 1,
        username: 'a@test.com',
        role: 'admin',
        isAdmin: true,
      };
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => payload,
      });

      const out = await main.syncCurrentUserFromServer();

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer jwt-1',
          }),
        }),
      );
      const u = JSON.parse(localStorage.getItem('user'));
      expect(u.role).toBe('admin');
      expect(u.isAdmin).toBe(true);
      expect(out).toEqual(payload);
    });
  });

  describe('serverAllowsUserManagement (Bug 0012)', () => {
    test('returns false without token', async () => {
      expect(await main.serverAllowsUserManagement()).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('returns true when GET /api/auth/users returns 200', async () => {
      localStorage.setItem('authToken', 'tok');
      global.fetch.mockResolvedValue({ status: 200 });

      const ok = await main.serverAllowsUserManagement();

      expect(ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/users',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer tok',
          }),
        }),
      );
    });

    test('returns false on 403', async () => {
      localStorage.setItem('authToken', 'tok');
      global.fetch.mockResolvedValue({ status: 403 });

      expect(await main.serverAllowsUserManagement()).toBe(false);
    });
  });

  describe('showError / showSuccess (container fallback)', () => {
    test('showError inserts .error into .container', () => {
      main.showError('oops');
      const errorDiv = document.querySelector('.container .error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv.textContent).toBe('oops');
    });

    test('showSuccess inserts .success into .container', () => {
      main.showSuccess('done');
      const el = document.querySelector('.container .success');
      expect(el).toBeTruthy();
      expect(el.textContent).toBe('done');
    });
  });
});
