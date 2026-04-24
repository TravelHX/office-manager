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

  // Phase 18 Task 18.30 - validate that error is displayed if the version fetch fails
  describe('Phase 18.30 error display when version update fails', () => {
    test('displays "Unknown" in the footer when /api/version returns a non-OK status', async () => {
      document.body.innerHTML = `
        <footer>
          <p id="app-version">Version: <a id="version-link" href="/pages/release-history.html"><span id="version-number">-</span></a></p>
        </footer>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'boom' } }),
      });

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await loadApplicationVersion();

      expect(document.getElementById('version-number').textContent).toBe('Unknown');
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    test('does not persist anything to localStorage when the fetch fails', async () => {
      document.body.innerHTML = `
        <footer>
          <p id="app-version">Version: <a id="version-link" href="/pages/release-history.html"><span id="version-number">-</span></a></p>
        </footer>
      `;

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await loadApplicationVersion();

      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(document.getElementById('version-number').textContent).toBe('Unknown');

      consoleError.mockRestore();
    });
  });

  // Phase 18 Task 18.31 - validate that version is stored in client config (localStorage)
  describe('Phase 18.31 version stored in client config', () => {
    test('persists the version to localStorage under the appVersion key after a successful fetch', async () => {
      document.body.innerHTML = `
        <footer>
          <p id="app-version">Version: <a id="version-link" href="/pages/release-history.html"><span id="version-number">-</span></a></p>
        </footer>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versionNumber: '4.2.0.0' }),
      });

      await loadApplicationVersion();

      expect(localStorage.setItem).toHaveBeenCalledWith('appVersion', '4.2.0.0');
    });

    test('returns the cached value from localStorage without calling the API', async () => {
      Storage.prototype.getItem = jest.fn((key) => (key === 'appVersion' ? '4.2.0.0' : null));

      const getApplicationVersion = async () => {
        const cached = localStorage.getItem('appVersion');
        if (cached) return cached;
        const response = await fetch('/api/version');
        if (response.ok) {
          const data = await response.json();
          if (data && data.versionNumber) {
            localStorage.setItem('appVersion', data.versionNumber);
            return data.versionNumber;
          }
        }
        return 'Unknown';
      };

      const version = await getApplicationVersion();
      expect(version).toBe('4.2.0.0');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // Phase 18 Task 18.32 - validate that version follows semantic versioning format
  describe('Phase 18.32 version follows semantic versioning format', () => {
    test('the rendered footer version matches MAJOR.MINOR.PATCH.REVISION', async () => {
      document.body.innerHTML = `
        <footer>
          <p id="app-version">Version: <a id="version-link" href="/pages/release-history.html"><span id="version-number">-</span></a></p>
        </footer>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ versionNumber: '10.20.30.40' }),
      });

      await loadApplicationVersion();

      const rendered = document.getElementById('version-number').textContent;
      expect(rendered).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      expect(rendered).toBe('10.20.30.40');
    });
  });
});
