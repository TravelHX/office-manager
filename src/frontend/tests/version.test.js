/**
 * Version Display Tests
 */

describe('Version Display', () => {
  let mockFetch;

  async function loadApplicationVersion() {
    try {
      const response = await fetch('/api/version');
      if (!response.ok) {
        throw new Error('Failed to fetch version');
      }
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
  }

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();

    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should load and display version from API', async () => {
    document.body.innerHTML = `
      <footer>
        <p id="app-version">Version: <a id="version-link" href="/pages/release-history.html"><span id="version-number">-</span></a></p>
      </footer>
    `;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        versionNumber: '1.2.3.0',
        deploymentInfo: 'Test deployment',
      }),
    });

    await loadApplicationVersion();

    const versionElement = document.getElementById('version-number');
    expect(versionElement.textContent).toBe('1.2.3.0');
    expect(localStorage.setItem).toHaveBeenCalledWith('appVersion', '1.2.3.0');
    expect(mockFetch).toHaveBeenCalledWith('/api/version');
    const link = document.getElementById('version-link');
    expect(link.getAttribute('href')).toBe('/pages/release-history.html');
  });

  test('should display "Unknown" on API error', async () => {
    document.body.innerHTML = `
      <footer>
        <p id="app-version">Version: <a id="version-link" href="/pages/release-history.html"><span id="version-number">-</span></a></p>
      </footer>
    `;

    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await loadApplicationVersion();

    const versionElement = document.getElementById('version-number');
    expect(versionElement.textContent).toBe('Unknown');
  });

  test('should get version from localStorage if available', async () => {
    Storage.prototype.getItem = jest.fn((key) => {
      if (key === 'appVersion') return '1.2.3.0';
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

    expect(version).toBe('1.2.3.0');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('should fetch from API if not in localStorage', async () => {
    Storage.prototype.getItem = jest.fn(() => null);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        versionNumber: '1.2.3.0',
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

    expect(version).toBe('1.2.3.0');
    expect(mockFetch).toHaveBeenCalledWith('/api/version');
    expect(localStorage.setItem).toHaveBeenCalledWith('appVersion', '1.2.3.0');
  });
});
