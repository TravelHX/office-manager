const BaseRepository = require('../data-access/base-repository');
const ParkingReservation = require('../models/ParkingReservation');

class ParkingReservationRepository extends BaseRepository {
  constructor() {
    super('parking_reservations');
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new ParkingReservation(result) : null;
  }

  async findByUserId(userId) {
    const query = `
      SELECT pr.*, ps.space_number, ps.location 
      FROM parking_reservations pr
      JOIN parking_spaces ps ON pr.parking_space_id = ps.id
      WHERE pr.user_id = ? 
      ORDER BY pr.reservation_date DESC, pr.created_at DESC
    `;
    const results = await this.executeRawQuery(query, [userId]);
    return results.map(row => ({
      ...new ParkingReservation(row).toJSON(),
      spaceNumber: row.space_number,
      location: row.location,
    }));
  }

  async findByParkingSpaceId(parkingSpaceId) {
    const query = 'SELECT * FROM parking_reservations WHERE parking_space_id = ? ORDER BY reservation_date, time_period';
    const results = await this.executeRawQuery(query, [parkingSpaceId]);
    return results.map(row => new ParkingReservation(row));
  }

  async findActiveByParkingSpaceId(parkingSpaceId) {
    const query = 'SELECT * FROM parking_reservations WHERE parking_space_id = ? AND status = ? ORDER BY reservation_date, time_period';
    const results = await this.executeRawQuery(query, [parkingSpaceId, 'active']);
    return results.map(row => new ParkingReservation(row));
  }

  async findConflictingReservations(parkingSpaceId, reservationDate, timePeriod, excludeReservationId = null) {
    // Conflict detection logic:
    // - full_day conflicts with morning, afternoon, or full_day
    // - morning conflicts with morning or full_day
    // - afternoon conflicts with afternoon or full_day
    let query = `
      SELECT * FROM parking_reservations 
      WHERE parking_space_id = ? 
        AND status = 'active'
        AND reservation_date = ?
        AND (
          (time_period = 'full_day')
          OR (time_period = ?)
          OR (? = 'full_day')
        )
    `;
    const params = [parkingSpaceId, reservationDate, timePeriod, timePeriod];
    
    if (excludeReservationId) {
      query += ' AND id != ?';
      params.push(excludeReservationId);
    }
    
    const results = await this.executeRawQuery(query, params);
    return results.map(row => new ParkingReservation(row));
  }

  async create(reservation) {
    const data = reservation instanceof ParkingReservation ? reservation.toDatabaseFormat() : reservation;
    const id = await super.create(data);
    return this.findById(id);
  }

  async update(id, reservation) {
    const data = reservation instanceof ParkingReservation ? reservation.toDatabaseFormat() : reservation;
    await super.update(id, data);
    return this.findById(id);
  }

  async cancel(id, cancelledBy, reason = null) {
    const query = `
      UPDATE parking_reservations 
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
      SELECT pr.*, ps.space_number, ps.location, u.username 
      FROM parking_reservations pr
      JOIN parking_spaces ps ON pr.parking_space_id = ps.id
      JOIN users u ON pr.user_id = u.id
      ORDER BY pr.reservation_date DESC, pr.created_at DESC
    `;
    const results = await this.executeRawQuery(query);
    return results.map(row => ({
      ...new ParkingReservation(row).toJSON(),
      spaceNumber: row.space_number,
      location: row.location,
      username: row.username,
    }));
  }
}

module.exports = ParkingReservationRepository;

