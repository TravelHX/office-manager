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
}

module.exports = BookingRepository;

