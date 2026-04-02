/**
 * @jest-environment jsdom
 */

describe('User provisioning form (Phase 19)', () => {
  const domContentLoadedCallbacks = [];
  let addEventListenerSpy;

  beforeEach(() => {
    jest.resetModules();
    domContentLoadedCallbacks.length = 0;
    const orig = Document.prototype.addEventListener.bind(document);
    addEventListenerSpy = jest.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'DOMContentLoaded') {
        domContentLoadedCallbacks.push(listener);
        return undefined;
      }
      return orig(type, listener, options);
    });

    global.fetch = jest.fn();
    global.showNotification = jest.fn();
    global.apiRequest = jest.fn().mockImplementation((url, opts) => {
      if (url === '/api/admin/configuration') {
        return Promise.resolve({ deskCount: 1, parkingCount: 1 });
      }
      if (url === '/api/auth/users' && opts && opts.method === 'POST') {
        return Promise.resolve({ id: 1 });
      }
      if (url === '/api/auth/users') {
        return Promise.resolve([]);
      }
      if (String(url).startsWith('/api/admin/')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
    global.isAdmin = jest.fn(() => true);
    mountMinimalAdminPage();
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    jest.clearAllMocks();
  });

  function loadAdminDashboard() {
    require('../js/admin.js');
    const cb = domContentLoadedCallbacks.pop();
    if (cb) {
      cb();
    }
  }

  function mountMinimalAdminPage() {
    document.body.innerHTML = `
      <div id="admin-container">
        <div id="admin-tabs">
          <button class="tab-btn active" data-tab="configuration">Resource Configuration</button>
          <button class="tab-btn" data-tab="desks">Desks</button>
          <button class="tab-btn" data-tab="parking-spaces">Parking Spaces</button>
          <button class="tab-btn" data-tab="bookings">All Bookings</button>
          <button class="tab-btn" data-tab="parking">All Parking Reservations</button>
          <button class="tab-btn" data-tab="overtime">All Overtime Records</button>
          <button class="tab-btn" data-tab="matrix">Booking Matrix</button>
          <button class="tab-btn" data-tab="users" id="users-tab-btn" style="display: none;">User Management</button>
          <button class="tab-btn" data-tab="password">Change Password</button>
        </div>
        <div id="configuration-tab" class="tab-content active">
          <input type="number" id="deskCount" value="1" />
          <select id="deskNumberingMode"><option value="auto">Auto</option></select>
          <input type="number" id="deskStartNumber" value="1" />
          <input type="number" id="parkingCount" value="1" />
          <select id="parkingNumberingMode"><option value="auto">Auto</option></select>
          <input type="number" id="parkingStartNumber" value="1" />
          <button id="saveConfigurationBtn">Save Configuration</button>
          <div id="configuration-message"></div>
        </div>
        <div id="desks-tab" class="tab-content"><div id="all-desks-container"></div></div>
        <div id="parking-spaces-tab" class="tab-content"><div id="all-parking-spaces-container"></div></div>
        <div id="bookings-tab" class="tab-content"><div id="all-bookings-container"></div></div>
        <div id="parking-tab" class="tab-content"><div id="all-parking-container"></div></div>
        <div id="overtime-tab" class="tab-content"><div id="all-overtime-container"></div></div>
        <div id="matrix-tab" class="tab-content"></div>
        <div id="users-tab" class="tab-content">
          <div id="all-users-container"></div>
          <div id="users-message"></div>
          <form id="user-creation-form">
            <input type="text" id="newProvisionName" value="Jane Doe">
            <input type="email" id="newEmail" value="jane@example.com">
            <input type="checkbox" id="newIsAdmin">
            <select id="newRole">
              <option value="user" selected>User</option>
              <option value="admin">Admin</option>
            </select>
          </form>
          <button id="createUserBtn">Create User</button>
          <div id="create-user-message"></div>
        </div>
        <div id="password-tab" class="tab-content">
          <input type="password" id="currentPassword" />
          <input type="password" id="newPasswordChange" />
          <input type="password" id="confirmPassword" />
          <button id="changePasswordBtn">Change Password</button>
          <div id="change-password-message"></div>
        </div>
      </div>
    `;
  }

  it('should POST name and email only (no password or office) for a standard user', async () => {
    loadAdminDashboard();

    await new Promise((r) => setTimeout(r, 50));

    global.apiRequest.mockClear();
    global.apiRequest.mockImplementation((url, opts) => {
      if (url === '/api/auth/users' && opts && opts.method === 'POST') {
        return Promise.resolve({
          id: 1,
          email: 'jane@example.com',
          profileSetupUrl: '/pages/complete-profile.html?token=abc',
        });
      }
      return Promise.resolve([]);
    });

    document.getElementById('createUserBtn').click();

    await new Promise((r) => setTimeout(r, 100));

    expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users', {
      method: 'POST',
      body: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user',
      },
    });
  });

  it('should send is_admin and admin role when admin checkbox is checked', async () => {
    loadAdminDashboard();
    await new Promise((r) => setTimeout(r, 50));

    document.getElementById('newIsAdmin').checked = true;

    global.apiRequest.mockClear();
    global.apiRequest.mockImplementation((url, opts) => {
      if (url === '/api/auth/users' && opts && opts.method === 'POST') {
        return Promise.resolve({ id: 2, profileSetupUrl: '/x' });
      }
      return Promise.resolve([]);
    });

    document.getElementById('createUserBtn').click();

    await new Promise((r) => setTimeout(r, 100));

    expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users', {
      method: 'POST',
      body: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'admin',
        is_admin: true,
      },
    });
  });

  it('should require email and name', async () => {
    document.getElementById('newProvisionName').value = '';
    document.getElementById('newEmail').value = '';

    loadAdminDashboard();
    await new Promise((r) => setTimeout(r, 50));

    global.apiRequest.mockClear();

    document.getElementById('createUserBtn').click();

    await new Promise((r) => setTimeout(r, 50));

    const messageDiv = document.getElementById('create-user-message');
    expect(messageDiv.innerHTML).toContain('Email and full name are required');
    expect(global.apiRequest).not.toHaveBeenCalled();
  });

  it('should show profile setup link when API returns profileSetupUrl', async () => {
    delete window.location;
    window.location = {
      origin: 'https://app.example',
      href: 'https://app.example/',
      assign: jest.fn(),
      replace: jest.fn(),
    };

    loadAdminDashboard();
    await new Promise((r) => setTimeout(r, 50));

    global.apiRequest.mockClear();
    global.apiRequest.mockImplementation((url, opts) => {
      if (url === '/api/auth/users' && opts && opts.method === 'POST') {
        return Promise.resolve({
          profileSetupUrl: '/pages/complete-profile.html?token=tok1',
        });
      }
      return Promise.resolve([]);
    });

    document.getElementById('createUserBtn').click();

    await new Promise((r) => setTimeout(r, 250));

    const messageDiv = document.getElementById('create-user-message');
    expect(messageDiv).toBeTruthy();
    expect(messageDiv.innerHTML).toContain('Profile setup link');
    expect(messageDiv.innerHTML).toContain(
      'https://app.example/pages/complete-profile.html?token=tok1',
    );
  });

  it('should clear name and email after successful provision', async () => {
    loadAdminDashboard();
    await new Promise((r) => setTimeout(r, 50));

    global.apiRequest.mockClear();
    global.apiRequest.mockImplementation((url, opts) => {
      if (url === '/api/auth/users' && opts && opts.method === 'POST') {
        return Promise.resolve({ id: 1 });
      }
      return Promise.resolve([]);
    });

    document.getElementById('createUserBtn').click();

    await new Promise((r) => setTimeout(r, 100));

    expect(document.getElementById('newProvisionName').value).toBe('');
    expect(document.getElementById('newEmail').value).toBe('');
    expect(document.getElementById('newIsAdmin').checked).toBe(false);
  });
});
