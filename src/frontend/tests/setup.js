// Jest setup for frontend tests
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.location
delete window.location;
window.location = {
  href: '',
  assign: jest.fn(),
  replace: jest.fn(),
};

// Mock window.confirm
window.confirm = jest.fn(() => true);

// Reset mocks before each test
beforeEach(() => {
  global.localStorage = localStorageMock;
  window.localStorage = localStorageMock;
  fetch.mockClear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  window.confirm.mockClear();
  window.location.href = '';
  document.body.innerHTML = '';
});

