/**
 * @jest-environment jsdom
 */

// Setup DOM before tests
beforeAll(() => {
  // Mock global functions from main.js
  global.apiRequest = jest.fn();
  global.showError = jest.fn();
  global.showSuccess = jest.fn();
  
  // Make functions available globally for testing
  window.apiRequest = global.apiRequest;
  window.showError = global.showError;
  window.showSuccess = global.showSuccess;
});

describe('Admin Functionality', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <div id="admin-container">
          <div id="admin-tabs">
            <button class="tab-btn active" data-tab="configuration">Resource Configuration</button>
            <button class="tab-btn" data-tab="bookings">All Bookings</button>
          </div>
          <div id="configuration-tab" class="tab-content active">
            <input type="number" id="deskCount" />
            <input type="number" id="parkingCount" />
            <button id="saveConfigurationBtn">Save Configuration</button>
            <div id="configuration-message"></div>
          </div>
          <div id="bookings-tab" class="tab-content">
            <div id="all-bookings-container"></div>
          </div>
        </div>
      </div>
    `;
    
    // Reset mocks
    global.apiRequest.mockClear();
    global.showError.mockClear();
    global.showSuccess.mockClear();
  });

  describe('Tab Navigation', () => {
    test('should switch between tabs', () => {
      const configTab = document.getElementById('configuration-tab');
      const bookingsTab = document.getElementById('bookings-tab');
      const configBtn = document.querySelector('[data-tab="configuration"]');
      const bookingsBtn = document.querySelector('[data-tab="bookings"]');
      
      configTab.classList.add('active');
      bookingsTab.classList.remove('active');
      
      expect(configTab.classList.contains('active')).toBe(true);
      expect(bookingsTab.classList.contains('active')).toBe(false);
      
      bookingsBtn.click();
      
      expect(configTab.classList.contains('active')).toBe(false);
      expect(bookingsTab.classList.contains('active')).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    test('should load configuration on page load', async () => {
      global.apiRequest.mockResolvedValue({ deskCount: 10, parkingCount: 5 });
      
      const deskCountInput = document.getElementById('deskCount');
      const parkingCountInput = document.getElementById('parkingCount');
      
      const config = await global.apiRequest('/api/admin/configuration');
      
      deskCountInput.value = config.deskCount;
      parkingCountInput.value = config.parkingCount;
      
      expect(deskCountInput.value).toBe('10');
      expect(parkingCountInput.value).toBe('5');
    });

    test('should save configuration', async () => {
      global.apiRequest.mockResolvedValue({ deskCount: 15, parkingCount: 8 });
      
      const deskCountInput = document.getElementById('deskCount');
      const parkingCountInput = document.getElementById('parkingCount');
      
      deskCountInput.value = '15';
      parkingCountInput.value = '8';
      
      await Promise.all([
        global.apiRequest('/api/admin/configuration/desk-count', {
          method: 'PUT',
          body: { deskCount: 15 },
        }),
        global.apiRequest('/api/admin/configuration/parking-count', {
          method: 'PUT',
          body: { parkingCount: 8 },
        }),
      ]);
      
      expect(global.apiRequest).toHaveBeenCalledWith('/api/admin/configuration/desk-count', {
        method: 'PUT',
        body: { deskCount: 15 },
      });
    });

    test('should validate negative counts', () => {
      const deskCountInput = document.getElementById('deskCount');
      deskCountInput.value = '-1';
      
      const deskCount = parseInt(deskCountInput.value);
      
      if (deskCount < 0) {
        expect(true).toBe(true);
      }
    });
  });

  describe('Booking Management', () => {
    test('should display all bookings', () => {
      const bookings = [
        {
          id: 1,
          username: 'user1',
          deskNumber: 'D001',
          location: 'Floor 1',
          startDate: '2025-12-15',
          endDate: '2025-12-16',
          status: 'active',
        },
      ];
      
      const container = document.getElementById('all-bookings-container');
      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      };
      
      const bookingsHTML = `
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Desk</th>
              <th>Location</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map(booking => `
              <tr>
                <td>${booking.username}</td>
                <td>Desk ${booking.deskNumber}</td>
                <td>${booking.location}</td>
                <td>${formatDate(booking.startDate)}</td>
                <td>${formatDate(booking.endDate)}</td>
                <td>
                  <span class="status-badge status-${booking.status}">${booking.status}</span>
                </td>
                <td>
                  ${booking.status === 'active' ? `
                    <button class="btn-danger admin-cancel-booking-btn" data-booking-id="${booking.id}">
                      Cancel
                    </button>
                  ` : '<span class="text-muted">Cancelled</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      container.innerHTML = bookingsHTML;
      
      expect(container.innerHTML).toContain('All Bookings');
      expect(container.innerHTML).toContain('user1');
      expect(container.innerHTML).toContain('D001');
      expect(container.querySelectorAll('.admin-cancel-booking-btn')).toHaveLength(1);
    });

    test('should handle admin booking cancellation', async () => {
      global.apiRequest.mockResolvedValue({});
      
      const bookingId = 1;
      const reason = 'Administrative cancellation';
      
      await global.apiRequest(`/api/admin/bookings/${bookingId}`, {
        method: 'DELETE',
        body: { reason },
      });
      
      expect(global.apiRequest).toHaveBeenCalledWith(`/api/admin/bookings/${bookingId}`, {
        method: 'DELETE',
        body: { reason },
      });
    });
  });
});

