// Phase 27a: Booking model unit tests focused on the new fobRequested
// field. The existing repository / service / integration tests already
// cover the pre-existing fields; this file lives at the model layer to
// keep the round-trip contract pinned: fob_requested round-trips through
// the model both ways and defaults to false when absent from the input.

const Booking = require('../../src/backend/models/Booking');

describe('Booking model (Phase 27a fobRequested)', () => {
  test('exposes fobRequested = false by default when fob_requested is absent', () => {
    const b = new Booking({
      id: 1,
      user_id: 5,
      desk_id: 7,
      start_date: '2099-09-09',
      end_date: '2099-09-09',
      status: 'active',
    });
    expect(b.fobRequested).toBe(false);
    expect(b.toJSON().fobRequested).toBe(false);
  });

  test('exposes fobRequested = true when fob_requested is truthy in the row', () => {
    const b = new Booking({
      id: 2,
      user_id: 5,
      desk_id: 7,
      start_date: '2099-09-09',
      end_date: '2099-09-09',
      status: 'active',
      fob_requested: 1, // MySQL TINYINT(1) round-trips as 1 / 0
    });
    expect(b.fobRequested).toBe(true);
    expect(b.toJSON().fobRequested).toBe(true);
  });

  test('coerces fob_requested = 0 to false', () => {
    const b = new Booking({
      id: 3,
      user_id: 5,
      desk_id: 7,
      start_date: '2099-09-09',
      end_date: '2099-09-09',
      status: 'active',
      fob_requested: 0,
    });
    expect(b.fobRequested).toBe(false);
  });

  test('toDatabaseFormat writes fob_requested = 0 when fobRequested is false (default)', () => {
    const b = new Booking({
      id: 4,
      user_id: 5,
      desk_id: 7,
      start_date: '2099-09-09',
      end_date: '2099-09-09',
      status: 'active',
    });
    expect(b.toDatabaseFormat().fob_requested).toBe(0);
  });

  test('toDatabaseFormat writes fob_requested = 1 when fobRequested is true', () => {
    const b = new Booking({
      id: 5,
      user_id: 5,
      desk_id: 7,
      start_date: '2099-09-09',
      end_date: '2099-09-09',
      status: 'active',
      fob_requested: true,
    });
    expect(b.toDatabaseFormat().fob_requested).toBe(1);
  });
});
