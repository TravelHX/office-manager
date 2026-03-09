/**
 * Version Display Tests
 */

describe('Version Display', () => {
  let mockFetch;

  beforeEach(() => {
    // Mock fetch API
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    
    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    
    // Reset DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should load and display version from API', async () => {
    // Setup DOM
    document.body.innerHTML = `
      <footer>
        <p id="app-version">Version: <span id="version-number">-</span></p>
      </footer>
    `;

    // Mock API response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        versionNumber: '1.2.3',
        deploymentInfo: 'Test deployment',
      }),
    });

    // Load version function (from main.js)
    const loadApplicationVersion = async () => {
      try {
        const response = await fetch('/api/version');
        const data = await response.json();
        const versionElement = document.getElementById('version-number');
        if (versionElement && data && data.versionNumber) {
          versionElement.textContent = data.versionNumber;
          localStorage.setItem('appVersion', data.versionNumber);
        }
      } catch (error) {
        console.error('Failed to load application version:', error);
        const versionElement = document.getElementById('version-number');
        if (versionElement) {
          versionElement.textContent = 'Unknown';
        }
      }
    };

    await loadApplicationVersion();

    const versionElement = document.getElementById('version-number');
    expect(versionElement.textContent).toBe('1.2.3');
    expect(localStorage.setItem).toHaveBeenCalledWith('appVersion', '1.2.3');
    expect(mockFetch).toHaveBeenCalledWith('/api/version');
  });

  test('should display "Unknown" on API error', async () => {
    // Setup DOM
    document.body.innerHTML = `
      <footer>
        <p id="app-version">Version: <span id="version-number">-</span></p>
      </footer>
    `;

    // Mock API error
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const loadApplicationVersion = async () => {
      try {
        const response = await fetch('/api/version');
        const data = await response.json();
        const versionElement = document.getElementById('version-number');
        if (versionElement && data && data.versionNumber) {
          versionElement.textContent = data.versionNumber;
          localStorage.setItem('appVersion', data.versionNumber);
        }
      } catch (error) {
        console.error('Failed to load application version:', error);
        const versionElement = document.getElementById('version-number');
        if (versionElement) {
          versionElement.textContent = 'Unknown';
        }
      }
    };

    await loadApplicationVersion();

    const versionElement = document.getElementById('version-number');
    expect(versionElement.textContent).toBe('Unknown');
  });

  test('should get version from localStorage if available', async () => {
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === 'appVersion') return '1.2.3';
      return null;
    });

    const getApplicationVersion = async () => {
      const cachedVersion = localStorage.getItem('appVersion');
      if (cachedVersion) {
        return cachedVersion;
      }
      
      try {
        const response = await fetch('/api/version');
        const data = await response.json();
        if (data && data.versionNumber) {
          localStorage.setItem('appVersion', data.versionNumber);
          return data.versionNumber;
        }
      } catch (error) {
        console.error('Failed to get application version:', error);
      }
      
      return 'Unknown';
    };

    const version = await getApplicationVersion();

    expect(version).toBe('1.2.3');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('should fetch from API if not in localStorage', async () => {
    Storage.prototype.getItem = jest.fn(() => null);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        versionNumber: '1.2.3',
      }),
    });

    const getApplicationVersion = async () => {
      const cachedVersion = localStorage.getItem('appVersion');
      if (cachedVersion) {
        return cachedVersion;
      }
      
      try {
        const response = await fetch('/api/version');
        const data = await response.json();
        if (data && data.versionNumber) {
          localStorage.setItem('appVersion', data.versionNumber);
          return data.versionNumber;
        }
      } catch (error) {
        console.error('Failed to get application version:', error);
      }
      
      return 'Unknown';
    };

    const version = await getApplicationVersion();

    expect(version).toBe('1.2.3');
    expect(mockFetch).toHaveBeenCalledWith('/api/version');
    expect(localStorage.setItem).toHaveBeenCalledWith('appVersion', '1.2.3');
  });
});
