/**
 * Phase 27c frontend tests for the Admin Fob UI helpers exported by
 * src/frontend/js/admin-fob.js. Mirrors the structure of
 * admin-audit.test.js: a thin DOM fixture, mocked apiRequest, and
 * assertions on the rendered markup + the API call shape.
 *
 * @jest-environment jsdom
 */

beforeAll(() => {
  global.apiRequest = jest.fn();
  globalThis.apiRequest = global.apiRequest;
  global.getAuthToken = () => 'test-token';
  globalThis.getAuthToken = global.getAuthToken;
  global.fetch = jest.fn();
  // Load the module — the IIFE installs window.* helpers we test below.
  require('../js/admin-fob.js');
});

beforeEach(() => {
  global.apiRequest.mockReset();
  if (global.fetch && global.fetch.mockReset) global.fetch.mockReset();
});

function fobManagementFixture() {
  document.body.innerHTML = `
    <input type="number" id="fobDefaultCount">
    <button id="fobDefaultSaveBtn"></button>
    <div id="fob-default-message"></div>
    <input type="date" id="fobOverrideDate">
    <input type="number" id="fobOverrideCount">
    <button id="fobOverrideSaveBtn"></button>
    <div id="fob-overrides-container"></div>
    <div id="fob-overrides-message"></div>
  `;
}

function fobCalendarFixture() {
  document.body.innerHTML = `
    <input type="date" id="fobCalendarStart" value="">
    <input type="date" id="fobCalendarEnd" value="">
    <button id="fobCalendarLoadBtn"></button>
    <div id="fob-calendar-container"></div>
    <div id="fob-calendar-message"></div>
  `;
}

function fobHistoryFixture() {
  document.body.innerHTML = `
    <input type="date" id="fobHistoryStart" value="">
    <input type="date" id="fobHistoryEnd" value="">
    <button id="fobHistoryLoadBtn"></button>
    <button id="fobHistoryExportBtn"></button>
    <div id="fob-history-container"></div>
    <div id="fob-history-message"></div>
  `;
}

describe('Phase 27c admin-fob: Fob Management', () => {
  beforeEach(() => fobManagementFixture());

  test('loadFobManagement populates the default input and renders override rows', async () => {
    global.apiRequest.mockResolvedValue({
      default: 5,
      overrides: [
        { date: '2099-10-09', count: 1 },
        { date: '2099-10-10', count: 0 },
      ],
    });

    await window.loadFobManagement();

    expect(global.apiRequest).toHaveBeenCalledWith('/api/admin/fob/inventory', undefined);
    expect(document.getElementById('fobDefaultCount').value).toBe('5');
    const container = document.getElementById('fob-overrides-container');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(container.innerHTML).toContain('2099-10-09');
    expect(container.innerHTML).toContain('2099-10-10');
    // Each override row exposes a Remove button with data-date wired up.
    expect(container.querySelectorAll('.fob-override-remove-btn')).toHaveLength(2);
  });

  test('renders an empty-state message when there are no overrides', async () => {
    global.apiRequest.mockResolvedValue({ default: null, overrides: [] });
    await window.loadFobManagement();
    expect(document.getElementById('fob-overrides-container').innerHTML).toMatch(/No per-date overrides/i);
    expect(document.getElementById('fobDefaultCount').value).toBe('');
  });

  test('saveFobDefault sends PUT with the parsed count and shows a success message', async () => {
    document.getElementById('fobDefaultCount').value = '7';
    global.apiRequest.mockResolvedValueOnce({ count: 7 });
    // The handler reloads after a successful save; supply the second response.
    global.apiRequest.mockResolvedValueOnce({ default: 7, overrides: [] });

    await window.saveFobDefault();

    expect(global.apiRequest).toHaveBeenCalledWith('/api/admin/fob/inventory/default', {
      method: 'PUT',
      body: { count: 7 },
    });
    expect(document.getElementById('fob-default-message').innerHTML).toMatch(/success/i);
  });

  test('saveFobDefault rejects negative counts with an inline error and does NOT call the API', async () => {
    document.getElementById('fobDefaultCount').value = '-1';
    await window.saveFobDefault();
    expect(global.apiRequest).not.toHaveBeenCalled();
    expect(document.getElementById('fob-default-message').innerHTML).toMatch(/non-negative/i);
  });

  test('saveFobOverride sends PUT /:date and shows a success message', async () => {
    document.getElementById('fobOverrideDate').value = '2099-10-12';
    document.getElementById('fobOverrideCount').value = '2';
    global.apiRequest.mockResolvedValueOnce({ date: '2099-10-12', count: 2 });
    global.apiRequest.mockResolvedValueOnce({ default: null, overrides: [{ date: '2099-10-12', count: 2 }] });

    await window.saveFobOverride();

    expect(global.apiRequest).toHaveBeenCalledWith('/api/admin/fob/inventory/2099-10-12', {
      method: 'PUT',
      body: { count: 2 },
    });
    expect(document.getElementById('fob-overrides-message').innerHTML).toMatch(/success/i);
  });

  test('removeFobOverride sends DELETE and refreshes the list', async () => {
    global.apiRequest.mockResolvedValueOnce(undefined);
    global.apiRequest.mockResolvedValueOnce({ default: null, overrides: [] });
    await window.removeFobOverride('2099-10-12');
    expect(global.apiRequest.mock.calls[0]).toEqual([
      '/api/admin/fob/inventory/2099-10-12',
      { method: 'DELETE' },
    ]);
  });
});

describe('Phase 27c admin-fob: Fob Calendar', () => {
  beforeEach(() => fobCalendarFixture());

  test('loadFobCalendar renders one row per day and flags exhausted days', async () => {
    document.getElementById('fobCalendarStart').value = '2099-10-05';
    document.getElementById('fobCalendarEnd').value = '2099-10-07';
    global.apiRequest.mockResolvedValue({
      startDate: '2099-10-05',
      endDate: '2099-10-07',
      days: [
        { date: '2099-10-05', configured: 1, requested: 1, available: 0 },
        { date: '2099-10-06', configured: 2, requested: 0, available: 2 },
        { date: '2099-10-07', configured: null, requested: 0, available: null },
      ],
    });

    await window.loadFobCalendar();

    expect(global.apiRequest).toHaveBeenCalledWith(
      '/api/admin/fob/calendar?startDate=2099-10-05&endDate=2099-10-07',
      undefined
    );
    const rows = document.querySelectorAll('.fob-calendar-row');
    expect(rows).toHaveLength(3);
    // Day 1 hits zero -> exhausted class flips on.
    expect(rows[0].classList.contains('fob-day-exhausted')).toBe(true);
    expect(rows[1].classList.contains('fob-day-exhausted')).toBe(false);
    // Day 3 has no configured inventory -> em dash placeholder.
    expect(rows[2].innerHTML).toContain('—');
  });

  test('shows an inline error when the user inverts the date range', async () => {
    document.getElementById('fobCalendarStart').value = '2099-10-10';
    document.getElementById('fobCalendarEnd').value = '2099-10-05';
    await window.loadFobCalendar();
    expect(global.apiRequest).not.toHaveBeenCalled();
    expect(document.getElementById('fob-calendar-message').innerHTML).toMatch(/Start date must be on or before/i);
  });
});

describe('Phase 27c admin-fob: Fob History', () => {
  beforeEach(() => fobHistoryFixture());

  test('loadFobHistory renders a row per allocation', async () => {
    document.getElementById('fobHistoryStart').value = '2099-10-01';
    document.getElementById('fobHistoryEnd').value = '2099-10-10';
    global.apiRequest.mockResolvedValue({
      rows: [
        {
          id: 99,
          userName: 'Alice Example',
          userEmail: 'alice@example.com',
          deskNumber: '12',
          startDate: '2099-10-05',
          endDate: '2099-10-05',
          status: 'active',
        },
      ],
    });

    await window.loadFobHistory();

    expect(global.apiRequest).toHaveBeenCalledWith(
      '/api/admin/fob/history?startDate=2099-10-01&endDate=2099-10-10',
      undefined
    );
    expect(document.querySelectorAll('.fob-history-table tbody tr')).toHaveLength(1);
    expect(document.body.innerHTML).toContain('alice@example.com');
    expect(document.body.innerHTML).toContain('Alice Example');
  });

  test('exportFobHistoryCsv triggers a Blob download with text/csv content type', async () => {
    document.getElementById('fobHistoryStart').value = '2099-10-01';
    document.getElementById('fobHistoryEnd').value = '2099-10-10';
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/csv; charset=utf-8' },
      text: async () => 'booking_id,user_email\n99,alice@example.com',
    });
    // jsdom doesn't implement Blob URLs by default; stub them just enough.
    const createObjectURL = jest.fn(() => 'blob:fake');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(global.URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(global.URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });

    await window.exportFobHistoryCsv();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/fob/history?startDate=2099-10-01&endDate=2099-10-10&format=csv',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'text/csv',
          Authorization: 'Bearer test-token',
        }),
      })
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(document.getElementById('fob-history-message').innerHTML).toMatch(/started/i);
  });

  test('exportFobHistoryCsv refuses to fire when start > end', async () => {
    document.getElementById('fobHistoryStart').value = '2099-10-10';
    document.getElementById('fobHistoryEnd').value = '2099-10-05';
    await window.exportFobHistoryCsv();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(document.getElementById('fob-history-message').innerHTML).toMatch(/Start date must be on or before/i);
  });
});
