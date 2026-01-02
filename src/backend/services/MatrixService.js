const BookingRepository = require('../repositories/BookingRepository');
const ParkingReservationRepository = require('../repositories/ParkingReservationRepository');
const UserRepository = require('../repositories/UserRepository');

class MatrixService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.reservationRepository = new ParkingReservationRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * Generate date range array
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Array<string>} Array of date strings
   */
  generateDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Get matrix data for bookings
   * @param {Object} options - Filter options
   * @param {string} options.startDate - Start date (YYYY-MM-DD)
   * @param {string} options.endDate - End date (YYYY-MM-DD)
   * @param {Array<number>} options.userIds - Optional user IDs filter
   * @param {Array<number>} options.deskIds - Optional desk IDs filter
   * @param {Array<number>} options.parkingSpaceIds - Optional parking space IDs filter
   * @param {string} options.type - 'desks', 'parking', or 'combined'
   * @returns {Promise<Object>} Matrix data structure
   */
  async getMatrixData(options = {}) {
    const {
      startDate,
      endDate,
      userIds = null,
      deskIds = null,
      parkingSpaceIds = null,
      type = 'combined',
    } = options;

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const dateRange = this.generateDateRange(startDate, endDate);

    // Get all users (or filtered users)
    let users = [];
    if (userIds && userIds.length > 0) {
      const userPromises = userIds.map(id => this.userRepository.findById(id));
      const userResults = await Promise.all(userPromises);
      users = userResults.filter(u => u !== null);
    } else {
      users = await this.userRepository.findAll();
    }

    // Get desk bookings
    let deskBookings = [];
    if (type === 'desks' || type === 'combined') {
      deskBookings = await this.getDeskBookingsForDateRange(startDate, endDate, userIds, deskIds);
    }

    // Get parking reservations
    let parkingReservations = [];
    if (type === 'parking' || type === 'combined') {
      parkingReservations = await this.getParkingReservationsForDateRange(
        startDate,
        endDate,
        userIds,
        parkingSpaceIds
      );
    }

    // Build matrix structure
    const matrix = {
      dateRange,
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
      })),
      data: {},
    };

    // Initialize matrix cells
    users.forEach(user => {
      matrix.data[user.id] = {};
      dateRange.forEach(date => {
        matrix.data[user.id][date] = {
          deskBookings: [],
          parkingReservations: [],
        };
      });
    });

    // Populate desk bookings
    deskBookings.forEach(booking => {
      const bookingDates = this.generateDateRange(booking.startDate, booking.endDate);
      bookingDates.forEach(date => {
        if (dateRange.includes(date)) {
          if (matrix.data[booking.userId] && matrix.data[booking.userId][date]) {
            matrix.data[booking.userId][date].deskBookings.push({
              id: booking.id,
              deskId: booking.deskId,
              deskNumber: booking.deskNumber || `Desk ${booking.deskId}`,
              location: booking.location || 'Office',
              startDate: booking.startDate,
              endDate: booking.endDate,
              status: booking.status,
            });
          }
        }
      });
    });

    // Populate parking reservations
    parkingReservations.forEach(reservation => {
      const date = reservation.reservationDate;
      if (dateRange.includes(date)) {
        if (matrix.data[reservation.userId] && matrix.data[reservation.userId][date]) {
          matrix.data[reservation.userId][date].parkingReservations.push({
            id: reservation.id,
            parkingSpaceId: reservation.parkingSpaceId,
            spaceNumber: reservation.spaceNumber || `Space ${reservation.parkingSpaceId}`,
            location: reservation.location || 'Parking Lot',
            reservationDate: reservation.reservationDate,
            timePeriod: reservation.timePeriod,
            status: reservation.status,
          });
        }
      }
    });

    return matrix;
  }

  /**
   * Get desk bookings for date range with filters
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {Array<number>} userIds - Optional user IDs filter
   * @param {Array<number>} deskIds - Optional desk IDs filter
   * @returns {Promise<Array>} Array of booking objects with desk info
   */
  async getDeskBookingsForDateRange(startDate, endDate, userIds = null, deskIds = null) {
    let query = `
      SELECT b.*, d.desk_number, d.location, COALESCE(u.username, 'Unknown User') as username
      FROM bookings b
      JOIN desks d ON b.desk_id = d.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.status = 'active'
        AND b.start_date <= ?
        AND b.end_date >= ?
    `;
    const params = [endDate, startDate];

    if (userIds && userIds.length > 0) {
      query += ' AND b.user_id IN (' + userIds.map(() => '?').join(',') + ')';
      params.push(...userIds);
    }

    if (deskIds && deskIds.length > 0) {
      query += ' AND b.desk_id IN (' + deskIds.map(() => '?').join(',') + ')';
      params.push(...deskIds);
    }

    query += ' ORDER BY b.start_date, b.user_id';

    const results = await this.bookingRepository.executeRawQuery(query, params);
    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      deskId: row.desk_id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      deskNumber: row.desk_number,
      location: row.location,
      username: row.username,
    }));
  }

  /**
   * Get all users for filtering
   * @returns {Promise<Array>} Array of user objects
   */
  async getAllUsers() {
    return await this.userRepository.findAll();
  }

  /**
   * Get parking reservations for date range with filters
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @param {Array<number>} userIds - Optional user IDs filter
   * @param {Array<number>} parkingSpaceIds - Optional parking space IDs filter
   * @returns {Promise<Array>} Array of reservation objects with parking space info
   */
  async getParkingReservationsForDateRange(startDate, endDate, userIds = null, parkingSpaceIds = null) {
    let query = `
      SELECT pr.*, ps.space_number, ps.location, COALESCE(u.username, 'Unknown User') as username
      FROM parking_reservations pr
      JOIN parking_spaces ps ON pr.parking_space_id = ps.id
      LEFT JOIN users u ON pr.user_id = u.id
      WHERE pr.status = 'active'
        AND pr.reservation_date >= ?
        AND pr.reservation_date <= ?
    `;
    const params = [startDate, endDate];

    if (userIds && userIds.length > 0) {
      query += ' AND pr.user_id IN (' + userIds.map(() => '?').join(',') + ')';
      params.push(...userIds);
    }

    if (parkingSpaceIds && parkingSpaceIds.length > 0) {
      query += ' AND pr.parking_space_id IN (' + parkingSpaceIds.map(() => '?').join(',') + ')';
      params.push(...parkingSpaceIds);
    }

    query += ' ORDER BY pr.reservation_date, pr.user_id';

    const results = await this.reservationRepository.executeRawQuery(query, params);
    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      parkingSpaceId: row.parking_space_id,
      reservationDate: row.reservation_date,
      timePeriod: row.time_period,
      status: row.status,
      spaceNumber: row.space_number,
      location: row.location,
      username: row.username,
    }));
  }
}

module.exports = MatrixService;

