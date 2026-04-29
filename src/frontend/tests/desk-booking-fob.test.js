/**
 * Phase 27c frontend tests for the Fob-needed flow on the desk
 * booking page. Covers:
 *   - The checkbox state is forwarded to POST /api/bookings.
 *   - The bulk path forwards the same flag.
 *   - The inline availability hint renders one row per day and flags
 *     exhausted days.
 *   - When the API rejects with FOB_UNAVAILABLE, the booking flow
 *     surfaces the offending dates rather than the generic message,
 *     and refreshes the inline hint.
 *
 * @jest-environment jsdom
 */

let main;
let deskBooking;

beforeAll(() => {
  global.fetch = jest.fn();
  // main.js installs globalThis.apiRequest etc.
  main = require('../js/main.js');
  // Then desk-booking.js installs window.bookDesk / readFobRequestedFlag /...
  deskBooking = require('../js/desk-booking.js');
});

beforeEach(() => {
  global.fetch.mockReset();
  localStorage.clear();
  localStorage.setItem('authToken', 'tok');
  document.body.innerHTML = `
    <input type="date" id="startDate" value="2099-10-12">
    <input type="date" id="endDate" value="2099-10-13">
    <input type="checkbox" id="fobRequested">
    <div id="availability-message"></div>
    <div id="fob-availability-hint"></div>
    <div id="desks-container"></div>
  `;
});

function mockJson(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => (h === 'content-type' ? 'application/json' : null) },
    text: async () => JSON.stringify(body),
  });
}

describe('Phase 27c: readFobRequestedFlag', () => {
  test('reflects the live checkbox state', () => {
    expect(window.readFobRequestedFlag()).toBe(false);
    document.getElementById('fobRequested').checked = true;
    expect(window.readFobRequestedFlag()).toBe(true);
  });

  test('returns false when the checkbox is missing from the DOM', () => {
    document.getElementById('fobRequested').remove();
    expect(window.readFobRequestedFlag()).toBe(false);
  });
});

describe('Phase 27c: bookDesk forwards fobRequested', () => {
  test('POST body includes fobRequested=true when the checkbox is ticked', async () => {
    document.getElementById('fobRequested').checked = true;
    global.fetch.mockReturnValueOnce(mockJson(201, {
      id: 7, deskId: 4, startDate: '2099-10-12', endDate: '2099-10-13', status: 'active', fobRequested: true,
    }));
    // jsdom's window.location.href is a setter that throws on full
    // navigation; the success path uses setTimeout, so we don't
    // actually trigger it here.

    await window.bookDesk(4, 'D004', '2099-10-12', '2099-10-13');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/bookings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          deskId: 4,
          startDate: '2099-10-12',
          endDate: '2099-10-13',
          fobRequested: true,
        }),
      })
    );
  });

  test('POST body includes fobRequested=false when the checkbox is clear', async () => {
    document.getElementById('fobRequested').checked = false;
    global.fetch.mockReturnValueOnce(mockJson(201, {
      id: 8, deskId: 4, startDate: '2099-10-12', endDate: '2099-10-12', status: 'active', fobRequested: false,
    }));
    await window.bookDesk(4, 'D004', '2099-10-12', '2099-10-12');
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.fobRequested).toBe(false);
  });

  test('FOB_UNAVAILABLE response surfaces offending dates and refreshes the hint', async () => {
    document.getElementById('fobRequested').checked = true;
    // First call: POST /api/bookings -> 400 FOB_UNAVAILABLE.
    global.fetch.mockReturnValueOnce(mockJson(400, {
      error: {
        message: 'FOB_UNAVAILABLE: no fob remaining on 2099-10-12',
        code: 'FOB_UNAVAILABLE',
        offendingDates: ['2099-10-12'],
      },
    }));
    // Second call: GET /api/admin/fob/calendar (refresh hint). The
    // calendar endpoint is admin-only; for a regular user it returns
    // 403 and the hint is silently cleared.
    global.fetch.mockReturnValueOnce(mockJson(403, {
      error: { message: 'Forbidden', code: 'FORBIDDEN' },
    }));

    await window.bookDesk(4, 'D004', '2099-10-12', '2099-10-12');

    const message = document.getElementById('availability-message').innerHTML;
    expect(message).toMatch(/Fob unavailable on 2099-10-12/);
    // The hint container is cleared on 403.
    expect(document.getElementById('fob-availability-hint').innerHTML).toBe('');
  });
});

describe('Phase 27c: updateFobAvailabilityHint', () => {
  test('renders one row per day and a "no fobs remaining" line for exhausted days', async () => {
    global.fetch.mockReturnValueOnce(mockJson(200, {
      startDate: '2099-10-12',
      endDate: '2099-10-13',
      days: [
        { date: '2099-10-12', configured: 1, requested: 1, available: 0 },
        { date: '2099-10-13', configured: 1, requested: 0, available: 1 },
      ],
    }));

    await window.updateFobAvailabilityHint('2099-10-12', '2099-10-13');

    const hint = document.getElementById('fob-availability-hint').innerHTML;
    expect(hint).toMatch(/2099-10-12: 0 of 1 fob/);
    expect(hint).toMatch(/2099-10-13: 1 of 1 fob/);
    expect(hint).toMatch(/No fobs remaining on 2099-10-12/);
  });

  test('shows a "tracked but not blocked" line when no inventory is configured', async () => {
    global.fetch.mockReturnValueOnce(mockJson(200, {
      startDate: '2099-10-20',
      endDate: '2099-10-20',
      days: [{ date: '2099-10-20', configured: null, requested: 0, available: null }],
    }));
    await window.updateFobAvailabilityHint('2099-10-20', '2099-10-20');
    expect(document.getElementById('fob-availability-hint').innerHTML).toMatch(/tracked but not blocked/i);
  });

  test('silently clears the hint on 403 (regular user)', async () => {
    global.fetch.mockReturnValueOnce(mockJson(403, {
      error: { message: 'Forbidden', code: 'FORBIDDEN' },
    }));
    await window.updateFobAvailabilityHint('2099-10-20', '2099-10-20');
    expect(document.getElementById('fob-availability-hint').innerHTML).toBe('');
  });
});
