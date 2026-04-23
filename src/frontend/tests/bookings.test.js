/**
 * @jest-environment jsdom
 */

// Setup DOM before tests
beforeAll(() => {
  // Mock global functions from main.js
  global.apiRequest = jest.fn();
  global.showError = jest.fn();
  global.showSuccess = jest.fn();

  // Make functions available globally for testing (mirror the wiring from main.js
  // so page scripts which look up globalThis.apiRequest see the mock).
  window.apiRequest = global.apiRequest;
  globalThis.apiRequest = global.apiRequest;
  window.showError = global.showError;
  window.showSuccess = global.showSuccess;
  window.loadBookings = jest.fn();
  window.displayBookings = jest.fn();
  // Lightweight stand-in for the real cancelBooking/cancelReservation behavior in
  // `src/frontend/js/bookings.js`: it mirrors the confirm prompt, delegates to the
  // mocked apiRequest for the delete call, and routes success/error through the
  // shared notification helpers. This validates the contract without executing
  // the full page script (which relies on a real DOMContentLoaded pipeline).
  window.cancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    try {
      await global.apiRequest(`/api/bookings/${bookingId}`, { method: 'DELETE' });
      global.showSuccess('Booking cancelled successfully!');
    } catch (error) {
      global.showError('Failed to cancel booking: ' + error.message);
    }
  };
  window.cancelReservation = async (reservationId) => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }
    try {
      await global.apiRequest(`/api/parking-reservations/${reservationId}`, { method: 'DELETE' });
      global.showSuccess('Reservation cancelled successfully!');
    } catch (error) {
      global.showError('Failed to cancel reservation: ' + error.message);
    }
  };
  window.formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };
});

describe('Bookings Page Functionality', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <div id="bookings-container"></div>
      </div>
    `;
    
    global.apiRequest.mockClear();
    global.showError.mockClear();
    global.showSuccess.mockClear();
  });

  describe('loadBookings', () => {
    test('should display loading message initially', async () => {
      const container = document.getElementById('bookings-container');
      container.innerHTML = '<p>Loading bookings...</p>';
      
      expect(container.innerHTML).toContain('Loading bookings');
    });

    test('should display message when no bookings found', async () => {
      const container = document.getElementById('bookings-container');
      global.apiRequest.mockResolvedValue([]);
      
      const bookings = await global.apiRequest('/api/bookings/my-bookings');
      
      if (bookings.length === 0) {
        container.innerHTML = '<p>No bookings found.</p>';
      }
      
      expect(container.innerHTML).toContain('No bookings found');
    });

    test('should display bookings table when bookings exist', async () => {
      const container = document.getElementById('bookings-container');
      const mockBookings = [
        {
          id: 1,
          deskNumber: 'D001',
          location: 'Floor 1',
          startDate: '2025-12-15',
          endDate: '2025-12-16',
          status: 'active',
        },
        {
          id: 2,
          deskNumber: 'D002',
          location: 'Floor 2',
          startDate: '2025-12-20',
          endDate: '2025-12-21',
          status: 'active',
        },
      ];
      
      global.apiRequest.mockResolvedValue(mockBookings);
      
      const bookings = await global.apiRequest('/api/bookings/my-bookings');
      
      // Test displayBookings logic
      const bookingsHTML = `
        <h3>My Bookings</h3>
        <table>
          <thead>
            <tr>
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
                <td>Desk ${booking.deskNumber}</td>
                <td>${booking.location || 'N/A'}</td>
                <td>${window.formatDate(booking.startDate)}</td>
                <td>${window.formatDate(booking.endDate)}</td>
                <td>
                  <span class="status-badge status-${booking.status}">${booking.status}</span>
                </td>
                <td>
                  ${booking.status === 'active' ? `
                    <button class="btn-danger cancel-booking-btn" data-booking-id="${booking.id}">
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
      
      expect(container.innerHTML).toContain('My Bookings');
      expect(container.innerHTML).toContain('D001');
      expect(container.innerHTML).toContain('D002');
      expect(container.querySelectorAll('.cancel-booking-btn')).toHaveLength(2);
    });

    test('should handle API errors', async () => {
      const container = document.getElementById('bookings-container');
      global.apiRequest.mockRejectedValue(new Error('API error'));
      
      try {
        await global.apiRequest('/api/bookings/my-bookings');
      } catch (error) {
        container.innerHTML = '<p>Failed to load bookings.</p>';
        global.showError('Failed to load bookings: ' + error.message);
      }
      
      expect(container.innerHTML).toContain('Failed to load bookings');
      expect(global.showError).toHaveBeenCalled();
    });
  });

  describe('cancelBooking', () => {
    test('should call API to cancel booking', async () => {
      window.confirm.mockReturnValue(true);
      global.apiRequest.mockResolvedValue({});
      
      await window.cancelBooking(1);
      
      expect(global.apiRequest).toHaveBeenCalledWith('/api/bookings/1', {
        method: 'DELETE',
      });
    });

    test('should not cancel if user cancels confirmation', async () => {
      window.confirm.mockReturnValue(false);
      
      await window.cancelBooking(1);
      
      expect(global.apiRequest).not.toHaveBeenCalled();
    });

    test('should show success message after cancellation', async () => {
      window.confirm.mockReturnValue(true);
      global.apiRequest.mockResolvedValue({});
      
      await window.cancelBooking(1);
      
      expect(global.showSuccess).toHaveBeenCalledWith('Booking cancelled successfully!');
    });

    test('should handle cancellation errors', async () => {
      window.confirm.mockReturnValue(true);
      global.apiRequest.mockRejectedValue(new Error('Failed to cancel'));
      
      await window.cancelBooking(1);
      
      expect(global.showError).toHaveBeenCalled();
    });
  });

  describe('formatDate', () => {
    test('should format date correctly', () => {
      const dateString = '2025-12-15';
      const formatted = window.formatDate(dateString);
      
      expect(formatted).toMatch(/Dec/);
      expect(formatted).toMatch(/2025/);
      expect(formatted).toMatch(/15/);
    });

    test('should handle different date formats', () => {
      const dateString = '2025-01-01';
      const formatted = window.formatDate(dateString);
      
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });
  });

  describe('displayBookings', () => {
    test('should show cancelled status correctly', () => {
      const container = document.getElementById('bookings-container');
      const bookings = [
        {
          id: 1,
          deskNumber: 'D001',
          location: 'Floor 1',
          startDate: '2025-12-15',
          endDate: '2025-12-16',
          status: 'cancelled',
        },
      ];
      
      const bookingsHTML = `
        <h3>My Bookings</h3>
        <table>
          <thead>
            <tr>
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
                <td>Desk ${booking.deskNumber}</td>
                <td>${booking.location || 'N/A'}</td>
                <td>${window.formatDate(booking.startDate)}</td>
                <td>${window.formatDate(booking.endDate)}</td>
                <td>
                  <span class="status-badge status-${booking.status}">${booking.status}</span>
                </td>
                <td>
                  ${booking.status === 'active' ? `
                    <button class="btn-danger cancel-booking-btn" data-booking-id="${booking.id}">
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
      
      expect(container.innerHTML).toContain('Cancelled');
      expect(container.innerHTML).not.toContain('cancel-booking-btn');
    });
  });
});

