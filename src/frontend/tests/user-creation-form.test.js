/**
 * @jest-environment jsdom
 */

describe('User Creation Form', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
    global.apiRequest = jest.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('User Creation Form Fields', () => {
    it('should collect all form fields including profile fields', async () => {
      global.apiRequest.mockResolvedValueOnce({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        officeLocation: 'London',
        isAdmin: false,
        role: 'user',
      });

      document.body.innerHTML = `
        <form id="user-creation-form">
          <input type="text" id="newUsername" value="newuser">
          <input type="text" id="newFirstName" value="John">
          <input type="text" id="newLastName" value="Doe">
          <input type="email" id="newEmail" value="newuser@example.com">
          <select id="newOfficeLocation">
            <option value="">Select location...</option>
            <option value="London" selected>London</option>
            <option value="Prague">Prague</option>
          </select>
          <input type="password" id="newPassword" value="password123">
          <input type="checkbox" id="newIsAdmin">
          <select id="newRole">
            <option value="user" selected>User</option>
            <option value="admin">Admin</option>
          </select>
          <div id="create-user-message"></div>
        </form>
        <button id="createUserBtn">Create User</button>
      `;

      // Mock admin.js functions
      global.isAdmin = jest.fn(() => true);
      global.apiRequest = jest.fn().mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
        firstName: 'John',
        lastName: 'Doe',
        officeLocation: 'London',
        isAdmin: false,
        role: 'user',
      });

      // Load admin.js
      require('../js/admin.js');

      const createButton = document.getElementById('createUserBtn');
      createButton.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users', {
        method: 'POST',
        body: expect.objectContaining({
          username: 'newuser',
          email: 'newuser@example.com',
          first_name: 'John',
          last_name: 'Doe',
          office_location: 'London',
          password: 'password123',
          role: 'user',
        }),
      });
    });

    it('should include is_admin flag when admin checkbox is checked', async () => {
      global.apiRequest.mockResolvedValueOnce({
        id: 1,
        username: 'adminuser',
        email: 'admin@example.com',
        isAdmin: true,
        role: 'admin',
      });

      document.body.innerHTML = `
        <form id="user-creation-form">
          <input type="text" id="newUsername" value="adminuser">
          <input type="text" id="newFirstName" value="">
          <input type="text" id="newLastName" value="">
          <input type="email" id="newEmail" value="admin@example.com">
          <select id="newOfficeLocation">
            <option value="">Select location...</option>
            <option value="London">London</option>
            <option value="Prague">Prague</option>
          </select>
          <input type="password" id="newPassword" value="password123">
          <input type="checkbox" id="newIsAdmin" checked>
          <select id="newRole">
            <option value="user">User</option>
            <option value="admin" selected>Admin</option>
          </select>
          <div id="create-user-message"></div>
        </form>
        <button id="createUserBtn">Create User</button>
      `;

      global.isAdmin = jest.fn(() => true);
      global.apiRequest = jest.fn().mockResolvedValue({
        id: 1,
        username: 'adminuser',
        email: 'admin@example.com',
        isAdmin: true,
        role: 'admin',
      });

      require('../js/admin.js');

      const createButton = document.getElementById('createUserBtn');
      createButton.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users', {
        method: 'POST',
        body: expect.objectContaining({
          username: 'adminuser',
          email: 'admin@example.com',
          is_admin: true,
          role: 'admin',
        }),
      });
    });

    it('should validate required fields (username, email, password)', async () => {
      document.body.innerHTML = `
        <form id="user-creation-form">
          <input type="text" id="newUsername" value="">
          <input type="email" id="newEmail" value="">
          <input type="password" id="newPassword" value="">
          <div id="create-user-message"></div>
        </form>
        <button id="createUserBtn">Create User</button>
      `;

      global.isAdmin = jest.fn(() => true);
      require('../js/admin.js');

      const createButton = document.getElementById('createUserBtn');
      createButton.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      const messageDiv = document.getElementById('create-user-message');
      expect(messageDiv.innerHTML).toContain('Please fill in all required fields');
      expect(global.apiRequest).not.toHaveBeenCalled();
    });

    it('should clear form fields after successful user creation', async () => {
      global.apiRequest.mockResolvedValueOnce({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
      });

      document.body.innerHTML = `
        <form id="user-creation-form">
          <input type="text" id="newUsername" value="newuser">
          <input type="text" id="newFirstName" value="John">
          <input type="text" id="newLastName" value="Doe">
          <input type="email" id="newEmail" value="newuser@example.com">
          <select id="newOfficeLocation">
            <option value="">Select location...</option>
            <option value="London" selected>London</option>
            <option value="Prague">Prague</option>
          </select>
          <input type="password" id="newPassword" value="password123">
          <input type="checkbox" id="newIsAdmin">
          <select id="newRole">
            <option value="user" selected>User</option>
            <option value="admin">Admin</option>
          </select>
          <div id="create-user-message"></div>
        </form>
        <button id="createUserBtn">Create User</button>
      `;

      global.isAdmin = jest.fn(() => true);
      global.apiRequest = jest.fn().mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
      });

      require('../js/admin.js');

      const createButton = document.getElementById('createUserBtn');
      createButton.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(document.getElementById('newUsername').value).toBe('');
      expect(document.getElementById('newFirstName').value).toBe('');
      expect(document.getElementById('newLastName').value).toBe('');
      expect(document.getElementById('newEmail').value).toBe('');
      expect(document.getElementById('newOfficeLocation').value).toBe('');
      expect(document.getElementById('newPassword').value).toBe('');
    });

    it('should display success message after successful creation', async () => {
      global.apiRequest.mockResolvedValueOnce({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
      });

      document.body.innerHTML = `
        <form id="user-creation-form">
          <input type="text" id="newUsername" value="newuser">
          <input type="email" id="newEmail" value="newuser@example.com">
          <input type="password" id="newPassword" value="password123">
          <div id="create-user-message"></div>
        </form>
        <button id="createUserBtn">Create User</button>
      `;

      global.isAdmin = jest.fn(() => true);
      global.apiRequest = jest.fn().mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
      });

      require('../js/admin.js');

      const createButton = document.getElementById('createUserBtn');
      createButton.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      const messageDiv = document.getElementById('create-user-message');
      expect(messageDiv.innerHTML).toContain('User created successfully');
    });
  });

  describe('Office Location Dropdown', () => {
    it('should have London and Prague as options', () => {
      document.body.innerHTML = `
        <select id="newOfficeLocation">
          <option value="">Select location...</option>
          <option value="London">London</option>
          <option value="Prague">Prague</option>
        </select>
      `;

      const dropdown = document.getElementById('newOfficeLocation');
      const options = Array.from(dropdown.options).map(opt => ({
        value: opt.value,
        text: opt.text,
      }));

      expect(options).toContainEqual({ value: '', text: 'Select location...' });
      expect(options).toContainEqual({ value: 'London', text: 'London' });
      expect(options).toContainEqual({ value: 'Prague', text: 'Prague' });
    });

    it('should allow selecting London', () => {
      document.body.innerHTML = `
        <select id="newOfficeLocation">
          <option value="">Select location...</option>
          <option value="London">London</option>
          <option value="Prague">Prague</option>
        </select>
      `;

      const dropdown = document.getElementById('newOfficeLocation');
      dropdown.value = 'London';

      expect(dropdown.value).toBe('London');
    });

    it('should allow selecting Prague', () => {
      document.body.innerHTML = `
        <select id="newOfficeLocation">
          <option value="">Select location...</option>
          <option value="London">London</option>
          <option value="Prague">Prague</option>
        </select>
      `;

      const dropdown = document.getElementById('newOfficeLocation');
      dropdown.value = 'Prague';

      expect(dropdown.value).toBe('Prague');
    });

    it('should allow empty selection (no office location)', () => {
      document.body.innerHTML = `
        <select id="newOfficeLocation">
          <option value="" selected>Select location...</option>
          <option value="London">London</option>
          <option value="Prague">Prague</option>
        </select>
      `;

      const dropdown = document.getElementById('newOfficeLocation');
      expect(dropdown.value).toBe('');
    });

    it('should include office_location in API request when selected', async () => {
      global.apiRequest.mockResolvedValueOnce({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
        officeLocation: 'Prague',
      });

      document.body.innerHTML = `
        <form id="user-creation-form">
          <input type="text" id="newUsername" value="newuser">
          <input type="email" id="newEmail" value="newuser@example.com">
          <select id="newOfficeLocation">
            <option value="">Select location...</option>
            <option value="London">London</option>
            <option value="Prague" selected>Prague</option>
          </select>
          <input type="password" id="newPassword" value="password123">
          <div id="create-user-message"></div>
        </form>
        <button id="createUserBtn">Create User</button>
      `;

      global.isAdmin = jest.fn(() => true);
      global.apiRequest = jest.fn().mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
        officeLocation: 'Prague',
      });

      require('../js/admin.js');

      const createButton = document.getElementById('createUserBtn');
      createButton.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(global.apiRequest).toHaveBeenCalledWith('/api/auth/users', {
        method: 'POST',
        body: expect.objectContaining({
          office_location: 'Prague',
        }),
      });
    });

    it('should not include office_location in API request when not selected', async () => {
      global.apiRequest.mockResolvedValueOnce({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
      });

      document.body.innerHTML = `
        <form id="user-creation-form">
          <input type="text" id="newUsername" value="newuser">
          <input type="email" id="newEmail" value="newuser@example.com">
          <select id="newOfficeLocation">
            <option value="" selected>Select location...</option>
            <option value="London">London</option>
            <option value="Prague">Prague</option>
          </select>
          <input type="password" id="newPassword" value="password123">
          <div id="create-user-message"></div>
        </form>
        <button id="createUserBtn">Create User</button>
      `;

      global.isAdmin = jest.fn(() => true);
      global.apiRequest = jest.fn().mockResolvedValue({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
      });

      require('../js/admin.js');

      const createButton = document.getElementById('createUserBtn');
      createButton.click();

      await new Promise(resolve => setTimeout(resolve, 100));

      const callArgs = global.apiRequest.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).not.toHaveProperty('office_location');
    });
  });
});
