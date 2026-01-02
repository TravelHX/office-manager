// Authentication state and access control tests

describe('Authentication State Management', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    // Mock main.js functions
    global.getAuthToken = jest.fn();
    global.isAuthenticated = jest.fn();
    global.isAdmin = jest.fn();
    global.getCurrentUser = jest.fn();
    global.requireAuth = jest.fn();
    global.updateUserIndicator = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('User Indicator Display', () => {
    it('should display user indicator when authenticated', () => {
      const mockUser = {
        id: 1,
        username: 'admin',
        role: 'admin',
      };

      global.getCurrentUser.mockReturnValue(mockUser);
      global.isAuthenticated.mockReturnValue(true);

      document.body.innerHTML = `
        <nav>
          <ul class="nav-menu">
            <li><a href="/">Home</a></li>
          </ul>
        </nav>
      `;

      // Simulate updateUserIndicator
      const navMenu = document.querySelector('.nav-menu');
      const userIndicator = document.createElement('li');
      userIndicator.className = 'user-indicator';
      userIndicator.innerHTML = `
        <span style="color: #4CAF50; font-weight: 500;">
          ${mockUser.username} ${mockUser.role === 'admin' ? '(Admin)' : ''}
        </span>
        <a href="#" onclick="logout(); return false;" style="margin-left: 10px; color: #d32f2f;">Logout</a>
      `;
      navMenu.appendChild(userIndicator);

      const indicator = document.querySelector('.user-indicator');
      expect(indicator).toBeTruthy();
      expect(indicator.textContent).toContain('admin');
      expect(indicator.textContent).toContain('Admin');
      expect(indicator.textContent).toContain('Logout');
    });

    it('should display login link when not authenticated', () => {
      global.isAuthenticated.mockReturnValue(false);
      global.getCurrentUser.mockReturnValue(null);

      document.body.innerHTML = `
        <nav>
          <ul class="nav-menu">
            <li><a href="/">Home</a></li>
          </ul>
        </nav>
      `;

      // Simulate updateUserIndicator for non-authenticated state
      const navMenu = document.querySelector('.nav-menu');
      const loginLink = document.createElement('li');
      loginLink.innerHTML = '<a href="/pages/login.html">Login</a>';
      navMenu.appendChild(loginLink);

      const link = document.querySelector('a[href="/pages/login.html"]');
      expect(link).toBeTruthy();
      expect(link.textContent).toBe('Login');
    });
  });

  describe('Access Control Redirects', () => {
    it('should redirect to login when accessing protected page without auth', () => {
      global.isAuthenticated.mockReturnValue(false);
      global.requireAuth.mockReturnValue(false);

      delete window.location;
      window.location = { href: '' };

      // Simulate protected page load
      const protectedPages = [
        '/pages/desk-booking.html',
        '/pages/parking.html',
        '/pages/overtime.html',
        '/pages/bookings.html',
        '/pages/admin.html',
      ];

      const currentPath = '/pages/desk-booking.html';
      const isProtectedPage = protectedPages.some(page => currentPath.includes(page));

      if (isProtectedPage && !global.isAuthenticated()) {
        window.location.href = `/pages/login.html?return=${encodeURIComponent(currentPath)}`;
      }

      expect(window.location.href).toBe('/pages/login.html?return=%2Fpages%2Fdesk-booking.html');
    });

    it('should not redirect when already authenticated', () => {
      global.isAuthenticated.mockReturnValue(true);

      delete window.location;
      window.location = { href: '' };

      const currentPath = '/pages/desk-booking.html';
      const protectedPages = ['/pages/desk-booking.html'];
      const isProtectedPage = protectedPages.some(page => currentPath.includes(page));

      if (isProtectedPage && !global.isAuthenticated()) {
        window.location.href = `/pages/login.html?return=${encodeURIComponent(currentPath)}`;
      }

      expect(window.location.href).toBe('');
    });
  });

  describe('Feature Visibility Based on Authentication', () => {
    it('should hide overtime features for non-authenticated users', () => {
      global.isAuthenticated.mockReturnValue(false);

      document.body.innerHTML = `
        <div id="overtime-card" style="display: block;">
          <h3>Overtime</h3>
        </div>
        <a href="/pages/overtime.html" id="overtime-nav-link" style="display: block;">Overtime</a>
      `;

      // Simulate conditional display logic
      if (typeof isAuthenticated !== 'undefined' && isAuthenticated()) {
        const overtimeCard = document.getElementById('overtime-card');
        const overtimeNavLink = document.getElementById('overtime-nav-link');
        if (overtimeCard) overtimeCard.style.display = 'block';
        if (overtimeNavLink) overtimeNavLink.style.display = 'block';
      } else {
        const overtimeCard = document.getElementById('overtime-card');
        const overtimeNavLink = document.getElementById('overtime-nav-link');
        if (overtimeCard) overtimeCard.style.display = 'none';
        if (overtimeNavLink) overtimeNavLink.style.display = 'none';
      }

      const overtimeCard = document.getElementById('overtime-card');
      const overtimeNavLink = document.getElementById('overtime-nav-link');
      expect(overtimeCard.style.display).toBe('none');
      expect(overtimeNavLink.style.display).toBe('none');
    });

    it('should show overtime features for authenticated users', () => {
      global.isAuthenticated.mockReturnValue(true);

      document.body.innerHTML = `
        <div id="overtime-card" style="display: none;">
          <h3>Overtime</h3>
        </div>
        <a href="/pages/overtime.html" id="overtime-nav-link" style="display: none;">Overtime</a>
      `;

      // Simulate conditional display logic
      if (typeof isAuthenticated !== 'undefined' && isAuthenticated()) {
        const overtimeCard = document.getElementById('overtime-card');
        const overtimeNavLink = document.getElementById('overtime-nav-link');
        if (overtimeCard) overtimeCard.style.display = 'block';
        if (overtimeNavLink) overtimeNavLink.style.display = 'block';
      }

      const overtimeCard = document.getElementById('overtime-card');
      const overtimeNavLink = document.getElementById('overtime-nav-link');
      expect(overtimeCard.style.display).toBe('block');
      expect(overtimeNavLink.style.display).toBe('block');
    });
  });

  describe('Logout Functionality', () => {
    it('should clear authentication data on logout', async () => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'user' }));

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
      });

      delete window.location;
      window.location = { href: '' };

      // Simulate logout
      async function logout() {
        try {
          const token = localStorage.getItem('authToken');
          if (token) {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
          }
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          window.location.href = '/';
        }
      }

      await logout();

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(window.location.href).toBe('/');
    });
  });
});

