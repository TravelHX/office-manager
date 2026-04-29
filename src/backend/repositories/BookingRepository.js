const BaseRepository = require('../data-access/base-repository');
const Booking = require('../models/Booking');

class BookingRepository extends BaseRepository {
  constructor() {
    super('bookings');
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new Booking(result) : null;
  }

  async findByUserId(userId) {
    const query = `
      SELECT b.*, d.desk_number, d.location 
      FROM bookings b
      JOIN desks d ON b.desk_id = d.id
      WHERE b.user_id = ? 
      ORDER BY b.start_date DESC, b.created_at DESC
    `;
    const results = await this.executeRawQuery(query, [userId]);
    return results.map(row => ({
      ...new Booking(row).toJSON(),
      deskNumber: row.desk_number,
      location: row.location,
    }));
  }

  async findByDeskId(deskId) {
    const query = 'SELECT * FROM bookings WHERE desk_id = ? ORDER BY start_date';
    const results = await this.executeRawQuery(query, [deskId]);
    return results.map(row => new Booking(row));
  }

  async findActiveByDeskId(deskId) {
    const query = 'SELECT * FROM bookings WHERE desk_id = ? AND status = ? ORDER BY start_date';
    const results = await this.executeRawQuery(query, [deskId, 'active']);
    return results.map(row => new Booking(row));
  }

  async findConflictingBookings(deskId, startDate, endDate, excludeBookingId = null) {
    // Standard date range overlap check: two ranges overlap if
    // existing_start <= new_end AND existing_end >= new_start
    let query = `
      SELECT * FROM bookings 
      WHERE desk_id = ? 
        AND status = 'active'
        AND start_date <= ?
        AND end_date >= ?
    `;
    const params = [deskId, endDate, startDate];
    
    if (excludeBookingId) {
      query += ' AND id != ?';
      params.push(excludeBookingId);
    }
    
    const results = await this.executeRawQuery(query, params);
    return results.map(row => new Booking(row));
  }

  async findOverlappingUserBookings(userId, startDate, endDate, excludeBookingId = null) {
    // Find all active bookings for this user that overlap with the given date range
    let query = `
      SELECT * FROM bookings 
      WHERE user_id = ? 
        AND status = 'active'
        AND start_date <= ?
        AND end_date >= ?
    `;
    const params = [userId, endDate, startDate];
    
    if (excludeBookingId) {
      query += ' AND id != ?';
      params.push(excludeBookingId);
    }
    
    const results = await this.executeRawQuery(query, params);
    return results.map(row => new Booking(row));
  }

  async create(booking) {
    const data = booking instanceof Booking ? booking.toDatabaseFormat() : booking;
    const id = await super.create(data);
    const createdBooking = await this.findById(id);
    if (!createdBooking) {
      throw new Error('Failed to retrieve created booking');
    }
    return createdBooking;
  }

  async update(id, booking) {
    const data = booking instanceof Booking ? booking.toDatabaseFormat() : booking;
    await super.update(id, data);
    return this.findById(id);
  }

  async cancel(id, cancelledBy, reason = null) {
    const query = `
      UPDATE bookings
      SET status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_by = ?,
          cancellation_reason = ?
      WHERE id = ?
    `;
    await this.executeRawQuery(query, [cancelledBy, reason, id]);
    return this.findById(id);
  }

  /**
   * Restore a previously-cancelled booking: flip status back to `active` and
   * clear the cancellation metadata. Phase 23c (Undo Desk Booking Cancel).
   * The caller (service layer) is responsible for enforcing the time window
   * and re-checking desk availability; this method is the unconditional
   * write.
   */
  async restore(id) {
    const query = `
      UPDATE bookings
      SET status = 'active',
          cancelled_at = NULL,
          cancelled_by = NULL,
          cancellation_reason = NULL
      WHERE id = ?
    `;
    await this.executeRawQuery(query, [id]);
    return this.findById(id);
  }

  async findAll() {
    const query = `
      SELECT b.*, d.desk_number, d.location, COALESCE(u.username, 'Unknown User') as username
      FROM bookings b
      JOIN desks d ON b.desk_id = d.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.start_date DESC, b.created_at DESC
    `;
    const results = await this.executeRawQuery(query);
    return results.map(row => ({
      ...new Booking(row).toJSON(),
      deskNumber: row.desk_number,
      location: row.location,
      username: row.username,
    }));
  }

  /**
   * Phase 27b: count active bookings with `fob_requested = 1` that
   * overlap a single calendar day. Drives the per-day fob enforcement
   * in BookingService.createBooking and the availability hint shown
   * to users when an inventory limit is configured.
   */
  async countActiveFobBookingsForDate(date, excludeBookingId = null) {
    let query = `
      SELECT COUNT(*) AS count
      FROM bookings
      WHERE fob_requested = 1
        AND status = 'active'
        AND start_date <= ?
        AND end_date >= ?
    `;
    const params = [date, date];
    if (excludeBookingId !== null) {
      query += ' AND id <> ?';
      params.push(excludeBookingId);
    }
    const rows = await this.executeRawQuery(query, params);
    return rows.length > 0 ? parseInt(rows[0].count, 10) : 0;
  }

  /**
   * Phase 27b: list every active fob-requested booking that overlaps
   * the inclusive date range [startDate, endDate]. The service's
   * `getAvailabilityForRange` aggregates these per-day in JS rather
   * than running one COUNT(*) query per day in the range.
   */
  async findActiveFobBookingsOverlapping(startDate, endDate) {
    const query = `
      SELECT id, user_id, desk_id, start_date, end_date, status, fob_requested
      FROM bookings
      WHERE fob_requested = 1
        AND status = 'active'
        AND start_date <= ?
        AND end_date >= ?
      ORDER BY start_date ASC, id ASC
    `;
    const rows = await this.executeRawQuery(query, [endDate, startDate]);
    return rows.map((row) => ({
      ...new Booking(row).toJSON(),
    }));
  }

  /**
   * Phase 27b: history report. Every booking with `fob_requested = 1`
   * whose date range overlaps [startDate, endDate], joined to user
   * info so the report can show name + email of the person who took
   * the fob. Cancelled rows are included so admins can see the
   * full allocation history; the row's `status` distinguishes
   * active vs cancelled fobs.
   */
  async findFobBookingsHistoryInRange(startDate, endDate) {
    const query = `
      SELECT b.id, b.user_id, b.desk_id, b.start_date, b.end_date, b.status,
             b.fob_requested, b.cancelled_at, b.cancellation_reason,
             d.desk_number, d.location,
             u.username AS user_email,
             u.first_name, u.last_name
      FROM bookings b
      JOIN desks d ON b.desk_id = d.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.fob_requested = 1
        AND b.start_date <= ?
        AND b.end_date >= ?
      ORDER BY b.start_date ASC, b.id ASC
    `;
    const rows = await this.executeRawQuery(query, [endDate, startDate]);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email || null,
      userName: [row.first_name, row.last_name].filter(Boolean).join(' ') || null,
      deskId: row.desk_id,
      deskNumber: row.desk_number,
      location: row.location,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
    }));
  }
}

module.exports = BookingRepository;

