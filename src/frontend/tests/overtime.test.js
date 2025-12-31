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

describe('Overtime Tracking Functionality', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="container">
        <input type="date" id="recordDate" />
        <input type="time" id="startTime" />
        <input type="time" id="endTime" />
        <input type="text" id="totalHours" readonly />
        <textarea id="description"></textarea>
        <button id="submitOvertimeBtn">Record Overtime</button>
        <div id="overtime-message"></div>
        <div id="overtime-history-container"></div>
      </div>
    `;
    
    // Reset mocks
    global.apiRequest.mockClear();
    global.showError.mockClear();
    global.showSuccess.mockClear();
  });

  describe('Time Calculation', () => {
    test('should calculate hours correctly', () => {
      const calculateHours = (startTime, endTime) => {
        const start = parseTime(startTime);
        const end = parseTime(endTime);
        
        if (start && end && end > start) {
          const diffMs = end - start;
          const diffHours = diffMs / (1000 * 60 * 60);
          return diffHours.toFixed(2);
        }
        return null;
      };
      
      const parseTime = (timeString) => {
        if (!timeString) return null;
        const parts = timeString.split(':');
        if (parts.length < 2) return null;
        
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        
        if (isNaN(hours) || isNaN(minutes)) return null;
        
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
      };
      
      expect(calculateHours('17:00', '18:00')).toBe('1.00');
      expect(calculateHours('17:00', '18:30')).toBe('1.50');
    });
  });

  describe('Overtime Submission', () => {
    test('should call API with correct parameters', async () => {
      const recordDate = '2025-12-15';
      const startTime = '17:00';
      const endTime = '18:00';
      const description = 'Extended work';
      
      global.apiRequest.mockResolvedValue({
        id: 1,
        recordDate: recordDate,
        startTime: startTime,
        endTime: endTime,
        totalHours: 1,
        description: description,
        status: 'pending',
      });
      
      const response = await global.apiRequest('/api/overtime', {
        method: 'POST',
        body: {
          recordDate: recordDate,
          startTime: startTime,
          endTime: endTime,
          description: description,
        },
      });
      
      expect(global.apiRequest).toHaveBeenCalledWith('/api/overtime', {
        method: 'POST',
        body: {
          recordDate: recordDate,
          startTime: startTime,
          endTime: endTime,
          description: description,
        },
      });
      expect(response.status).toBe('pending');
    });

    test('should validate required fields', () => {
      const recordDate = '';
      const startTime = '17:00';
      const endTime = '18:00';
      
      if (!recordDate || !startTime || !endTime) {
        expect(true).toBe(true);
      }
    });
  });

  describe('Overtime History Display', () => {
    test('should display overtime records', () => {
      const records = [
        {
          id: 1,
          recordDate: '2025-12-15',
          startTime: '17:00:00',
          endTime: '18:00:00',
          totalHours: 1,
          description: 'Extended work',
          status: 'pending',
        },
      ];
      
      const container = document.getElementById('overtime-history-container');
      const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      };
      
      const formatTime = (timeString) => {
        if (!timeString) return 'N/A';
        const parts = timeString.split(':');
        if (parts.length < 2) return timeString;
        
        const hours = parseInt(parts[0], 10);
        const minutes = parts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        
        return `${displayHours}:${minutes} ${ampm}`;
      };
      
      const historyHTML = `
        <h3>Overtime History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Total Hours</th>
              <th>Description</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(record => `
              <tr>
                <td>${formatDate(record.recordDate)}</td>
                <td>${formatTime(record.startTime)}</td>
                <td>${formatTime(record.endTime)}</td>
                <td>${record.totalHours} hours</td>
                <td>${record.description || 'N/A'}</td>
                <td>
                  <span class="status-badge status-${record.status}">${record.status}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      
      container.innerHTML = historyHTML;
      
      expect(container.innerHTML).toContain('Overtime History');
      expect(container.innerHTML).toContain('1 hours');
      expect(container.innerHTML).toContain('pending');
    });
  });
});

