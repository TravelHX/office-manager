/**
 * Phase 26b frontend tests for the Office Administrator role.
 *
 * Drives the real admin.js helpers via the module.exports block at the
 * bottom of the file (parallel to how main.js is exported and tested).
 *
 *   - applyRoleSidebarVariant({ isFullAdmin, isOfficeAdmin }) hides the
 *     admin-only nav buttons (Configuration / Desks / Parking Spaces /
 *     Matrix) and switches the active tab to "All Bookings" for OAs.
 *     Full admins keep the default sidebar exactly as the HTML ships it.
 *   - renderRoleCell(user, isSelf) renders the per-row role <select> + Save
 *     control for the User Management table, with the three canonical roles.
 *   - saveUserRole(id, role) calls PUT /api/auth/users/:id/role and
 *     surfaces a friendly "Cannot demote: ..." error when the server
 *     rejects with the last-admin invariant.
 *
 * @jest-environment jsdom
 */

let admin;

beforeAll(() => {
  // admin.js requires globalThis.apiRequest at call time, not at module
  // load time. Stub it before requiring so the require itself doesn't
  // throw if someone changes that contract.
  global.apiRequest = jest.fn();
  globalThis.apiRequest = global.apiRequest;
  admin = require('../js/admin.js');
});

/**
 * Recreate the chunk of admin.html sidebar that admin.js gates on.
 * We don't load the whole page — only the buttons + tab content elements
 * that applyRoleSidebarVariant looks up.
 */
function buildAdminSidebarFixture() {
  document.body.innerHTML = `
    <ul class="sidebar-nav">
      <li><button class="tab-btn active" data-tab="configuration">Resource Configuration</button></li>
      <li><button class="tab-btn" data-tab="desks">Desks</button></li>
      <li><button class="tab-btn" data-tab="parking-spaces">Parking Spaces</button></li>
      <li><button class="tab-btn" data-tab="bookings">All Bookings</button></li>
      <li><button class="tab-btn" data-tab="parking">All Parking Reservations</button></li>
      <li><button class="tab-btn" data-tab="matrix">Booking Matrix</button></li>
      <li><button class="tab-btn" data-tab="users" id="users-tab-btn" style="display: none;">User Management</button></li>
      <li><button class="tab-btn" data-tab="audit" id="audit-tab-btn" style="display: none;">Audit</button></li>
      <li><button class="tab-btn" data-tab="maps" id="maps-tab-btn" style="display: none;">Maps</button></li>
      <li><button class="tab-btn" data-tab="password">Change Password</button></li>
    </ul>
    <div id="configuration-tab" class="tab-content active"></div>
    <div id="desks-tab" class="tab-content"></div>
    <div id="parking-spaces-tab" class="tab-content"></div>
    <div id="bookings-tab" class="tab-content"></div>
    <div id="parking-tab" class="tab-content"></div>
    <div id="matrix-tab" class="tab-content"></div>
    <div id="users-tab" class="tab-content"></div>
    <div id="audit-tab" class="tab-content"></div>
    <div id="maps-tab" class="tab-content"></div>
    <div id="password-tab" class="tab-content"></div>
  `;
}

describe('Phase 26b: applyRoleSidebarVariant', () => {
  beforeEach(() => {
    buildAdminSidebarFixture();
  });

  test('hides Configuration / Desks / Parking Spaces / Matrix and activates Bookings for office_admin', () => {
    admin.applyRoleSidebarVariant({ isFullAdmin: false, isOfficeAdmin: true });

    const hiddenTabs = ['configuration', 'desks', 'parking-spaces', 'matrix'];
    hiddenTabs.forEach((name) => {
      const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
      expect(btn).not.toBeNull();
      expect(btn.style.display).toBe('none');
      expect(btn.classList.contains('active')).toBe(false);
      const content = document.getElementById(`${name}-tab`);
      expect(content.classList.contains('active')).toBe(false);
    });

    const bookingsBtn = document.querySelector('.tab-btn[data-tab="bookings"]');
    const bookingsContent = document.getElementById('bookings-tab');
    expect(bookingsBtn.classList.contains('active')).toBe(true);
    expect(bookingsContent.classList.contains('active')).toBe(true);
  });

  test('keeps the default sidebar untouched for full admin', () => {
    admin.applyRoleSidebarVariant({ isFullAdmin: true, isOfficeAdmin: false });

    // Configuration is still the active tab and visible.
    const configBtn = document.querySelector('.tab-btn[data-tab="configuration"]');
    const configContent = document.getElementById('configuration-tab');
    expect(configBtn.style.display).not.toBe('none');
    expect(configContent.classList.contains('active')).toBe(true);

    // OA-only hidden tabs are still rendered (no display tweak).
    ['desks', 'parking-spaces', 'matrix', 'bookings'].forEach((name) => {
      const btn = document.querySelector(`.tab-btn[data-tab="${name}"]`);
      expect(btn.style.display).not.toBe('none');
    });
  });

  test('keeps the default sidebar untouched for plain users (no flags set)', () => {
    admin.applyRoleSidebarVariant({ isFullAdmin: false, isOfficeAdmin: false });
    const configBtn = document.querySelector('.tab-btn[data-tab="configuration"]');
    expect(configBtn.style.display).not.toBe('none');
    expect(configBtn.classList.contains('active')).toBe(true);
  });

  test('does not reveal admin-only User Management / Audit / Maps for office_admin', () => {
    admin.applyRoleSidebarVariant({ isFullAdmin: false, isOfficeAdmin: true });
    // applyRoleSidebarVariant does NOT touch these — they remain
    // display:none from the HTML. The userManagementEnabled gate (which
    // probes /api/auth/users) is what reveals them, and that returns 403
    // for office_admin.
    expect(document.getElementById('users-tab-btn').style.display).toBe('none');
    expect(document.getElementById('audit-tab-btn').style.display).toBe('none');
    expect(document.getElementById('maps-tab-btn').style.display).toBe('none');
  });
});

describe('Phase 26b: renderRoleCell', () => {
  test('renders a static badge (no select) for the current admin\'s own row', () => {
    const html = admin.renderRoleCell(
      { id: 1, username: 'meadmin', role: 'admin' },
      true,
    );
    expect(html).toContain('status-badge');
    expect(html).toContain('admin');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('save-role-btn');
  });

  test('renders a select with all three roles for another user', () => {
    const html = admin.renderRoleCell(
      { id: 99, username: 'bob', role: 'user' },
      false,
    );
    expect(html).toContain('<select');
    expect(html).toContain('class="user-role-select"');
    expect(html).toContain('data-user-id="99"');
    expect(html).toContain('value="user"');
    expect(html).toContain('value="office_admin"');
    expect(html).toContain('value="admin"');
    // The current role is preselected.
    expect(html).toMatch(/<option value="user" selected/);
  });

  test('preselects office_admin when the user is already an OA', () => {
    const html = admin.renderRoleCell(
      { id: 7, username: 'oa', role: 'office_admin' },
      false,
    );
    expect(html).toMatch(/<option value="office_admin" selected/);
  });

  test('renders a Save button that starts disabled and carries data attrs', () => {
    const html = admin.renderRoleCell(
      { id: 5, username: 'jane', role: 'user' },
      false,
    );
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const btn = tmp.querySelector('button.save-role-btn');
    expect(btn).not.toBeNull();
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('data-user-id')).toBe('5');
    expect(btn.getAttribute('data-original-role')).toBe('user');
  });
});

describe('Phase 26b: saveUserRole', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="users-message"></div>';
    global.apiRequest.mockReset();
    globalThis.apiRequest = global.apiRequest;
  });

  test('calls PUT /api/auth/users/:id/role with the new role', async () => {
    global.apiRequest.mockResolvedValue({});
    await admin.saveUserRole(42, 'office_admin');
    expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users/42/role', {
      method: 'PUT',
      body: { role: 'office_admin' },
    });
  });

  test('shows a friendly "Cannot demote" message when the server rejects with last-admin invariant', async () => {
    global.apiRequest.mockRejectedValue(new Error('Cannot demote the last admin user.'));
    await admin.saveUserRole(1, 'user');
    const msg = document.getElementById('users-message').innerHTML;
    expect(msg).toContain('error');
    expect(msg).toContain('Cannot demote');
  });

  test('shows a generic failure message for other errors', async () => {
    global.apiRequest.mockRejectedValue(new Error('Network blew up'));
    await admin.saveUserRole(1, 'user');
    const msg = document.getElementById('users-message').innerHTML;
    expect(msg).toContain('error');
    expect(msg).toContain('Failed to update role');
    expect(msg).toContain('Network blew up');
  });
});
