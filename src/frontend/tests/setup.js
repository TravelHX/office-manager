// Jest setup for frontend tests
function defaultFetchResponse(url) {
  const u = String(url);
  if (u.includes('/api/version')) {
    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ versionNumber: '0.0.0-test' }),
    });
  }
  if (u.includes('/api/auth/check-users')) {
    return Promise.resolve({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ hasUsers: true }),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({}),
    text: async () => '{}',
  });
}

global.fetch = jest.fn().mockImplementation((url) => defaultFetchResponse(url));

// Simple in-memory localStorage (jsdom default can be flaky across resets)
const storage = {};
const localStorageImpl = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
  setItem: (k, v) => {
    storage[k] = String(v);
  },
  removeItem: (k) => {
    delete storage[k];
  },
  clear: () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  },
};
global.localStorage = localStorageImpl;
window.localStorage = localStorageImpl;

// Globals normally provided by main.js on real pages (login.js, etc.)
global.getAuthToken = () => localStorageImpl.getItem('authToken');

// Mock window.location (include pathname for main.js and page scripts)
delete window.location;
window.location = {
  href: '',
  pathname: '',
  search: '',
  assign: jest.fn(),
  replace: jest.fn(),
};

// Mock window.confirm
window.confirm = jest.fn(() => true);

// Reset mocks before each test
beforeEach(() => {
  global.fetch.mockReset();
  global.fetch.mockImplementation((url) => defaultFetchResponse(url));
  localStorageImpl.clear();
  window.confirm.mockClear();
  window.location.href = '';
  window.location.pathname = '';
  window.location.search = '';
  document.body.innerHTML = '';
});
