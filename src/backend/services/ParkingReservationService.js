const ParkingReservationRepository = require('../repositories/ParkingReservationRepository');
const ParkingSpaceRepository = require('../repositories/ParkingSpaceRepository');
const ParkingSpaceService = require('./ParkingSpaceService');
const ParkingReservation = require('../models/ParkingReservation');

class ParkingReservationService {
  constructor() {
    this.reservationRepository = new ParkingReservationRepository();
    this.parkingSpaceRepository = new ParkingSpaceRepository();
    this.parkingSpaceService = new ParkingSpaceService();
  }

  async createReservation(userId, parkingSpaceId, reservationDate, timePeriod) {
    if (!reservationDate) {
      throw new Error('Reservation date is required');
    }

    if (!timePeriod || !['morning', 'afternoon', 'full_day'].includes(timePeriod)) {
      throw new Error('Time period must be morning, afternoon, or full_day');
    }

    const date = new Date(reservationDate);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new Error('Cannot reserve parking spaces for past dates');
    }

    const parkingSpace = await this.parkingSpaceRepository.findById(parkingSpaceId);
    if (!parkingSpace) {
      throw new Error('Parking space not found');
    }

    if (!parkingSpace.isActive) {
      throw new Error('Parking space is not available');
    }

    // Validate: Check if user already has overlapping parking reservations
    const userOverlaps = await this.reservationRepository.findOverlappingUserReservations(
      userId,
      reservationDate,
      timePeriod
    );
    if (userOverlaps.length > 0) {
      const conflictingReservation = userOverlaps[0];
      const timePeriodLabel = timePeriod === 'full_day' ? 'full day' : timePeriod;
      throw new Error(
        `You already have a parking reservation (Space ${conflictingReservation.parkingSpaceId}) for ${reservationDate} ` +
        `with time period "${conflictingReservation.timePeriod}". ` +
        `You cannot book multiple parking spaces for overlapping periods on the same date.`
      );
    }

    // Validate: Check if parking space is already reserved by another user
    const availability = await this.parkingSpaceService.checkParkingSpaceAvailability(
      parkingSpaceId,
      reservationDate,
      timePeriod
    );
    if (!availability.available) {
      if (availability.conflicts && availability.conflicts.length > 0) {
        const conflict = availability.conflicts[0];
        const timePeriodLabel = timePeriod === 'full_day' ? 'full day' : timePeriod;
        throw new Error(
          `Parking space ${parkingSpace.spaceNumber || parkingSpaceId} is already reserved by another user ` +
          `for ${reservationDate} with time period "${timePeriodLabel}". ` +
          `The existing reservation has time period "${conflict.timePeriod}".`
        );
      }
      throw new Error('Parking space is not available for the selected date and time period');
    }

    const reservation = new ParkingReservation({
      user_id: userId,
      parking_space_id: parkingSpaceId,
      reservation_date: reservationDate,
      time_period: timePeriod,
      status: 'active',
    });

    return await this.reservationRepository.create(reservation);
  }

  async getReservationById(id) {
    const reservation = await this.reservationRepository.findById(id);
    if (!reservation) {
      throw new Error('Reservation not found');
    }
    return reservation;
  }

  async getUserReservations(userId) {
    return await this.reservationRepository.findByUserId(userId);
  }

  async getAllReservations() {
    return await this.reservationRepository.findAll();
  }

  async cancelReservation(reservationId, cancelledBy, reason = null) {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status === 'cancelled') {
      throw new Error('Reservation is already cancelled');
    }

    return await this.reservationRepository.cancel(reservationId, cancelledBy, reason);
  }

  async cancelUserReservation(reservationId, userId) {
    const reservation = await this.reservationRepository.findById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.userId !== userId) {
      throw new Error('You can only cancel your own reservations');
    }

    return await this.cancelReservation(reservationId, userId);
  }

  async checkAvailability(parkingSpaceId, reservationDate, timePeriod) {
    return await this.parkingSpaceService.checkParkingSpaceAvailability(
      parkingSpaceId,
      reservationDate,
      timePeriod
    );
  }

  async getAvailableParkingSpaces(reservationDate, timePeriod) {
    return await this.parkingSpaceService.getAvailableParkingSpaces(reservationDate, timePeriod);
  }

  async getAvailabilityInfo(reservationDate, timePeriod) {
    return await this.parkingSpaceService.getAvailabilityInfo(reservationDate, timePeriod);
  }

  async createBulkReservations(userId, parkingSpaceIds, reservationDate, timePeriod) {
    if (!parkingSpaceIds || !Array.isArray(parkingSpaceIds) || parkingSpaceIds.length === 0) {
      throw new Error('At least one parking space ID is required');
    }

    if (!reservationDate) {
      throw new Error('Reservation date is required');
    }

    if (!timePeriod || !['morning', 'afternoon', 'full_day'].includes(timePeriod)) {
      throw new Error('Time period must be morning, afternoon, or full_day');
    }

    const date = new Date(reservationDate);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new Error('Cannot reserve parking spaces for past dates');
    }

    // Validate: Check if user already has overlapping parking reservations
    const userOverlaps = await this.reservationRepository.findOverlappingUserReservations(
      userId,
      reservationDate,
      timePeriod
    );
    if (userOverlaps.length > 0) {
      const conflictingReservation = userOverlaps[0];
      const timePeriodLabel = timePeriod === 'full_day' ? 'full day' : timePeriod;
      throw new Error(
        `You already have a parking reservation (Space ${conflictingReservation.parkingSpaceId}) for ${reservationDate} ` +
        `with time period "${conflictingReservation.timePeriod}". ` +
        `You cannot book multiple parking spaces for overlapping periods on the same date.`
      );
    }

    // Validate all parking spaces exist and are available
    const results = {
      successful: [],
      failed: [],
      errors: [],
    };

    for (const parkingSpaceId of parkingSpaceIds) {
      try {
        const parkingSpace = await this.parkingSpaceRepository.findById(parkingSpaceId);
        if (!parkingSpace) {
          results.failed.push({ parkingSpaceId, reason: 'Parking space not found' });
          results.errors.push(`Parking space ${parkingSpaceId} not found`);
          continue;
        }

        if (!parkingSpace.isActive) {
          results.failed.push({ parkingSpaceId, reason: 'Parking space is not available' });
          results.errors.push(`Parking space ${parkingSpace.spaceNumber || parkingSpaceId} is not available`);
          continue;
        }

        // Check if parking space is already reserved by another user
        const availability = await this.parkingSpaceService.checkParkingSpaceAvailability(
          parkingSpaceId,
          reservationDate,
          timePeriod
        );
        if (!availability.available) {
          if (availability.conflicts && availability.conflicts.length > 0) {
            const conflict = availability.conflicts[0];
            const timePeriodLabel = timePeriod === 'full_day' ? 'full day' : timePeriod;
            results.failed.push({ parkingSpaceId, reason: 'Parking space already reserved' });
            results.errors.push(
              `Parking space ${parkingSpace.spaceNumber || parkingSpaceId} is already reserved by another user ` +
              `for ${reservationDate} with time period "${timePeriodLabel}"`
            );
          } else {
            results.failed.push({ parkingSpaceId, reason: 'Parking space not available' });
            results.errors.push(`Parking space ${parkingSpace.spaceNumber || parkingSpaceId} is not available for the selected date and time period`);
          }
          continue;
        }

        // Create the reservation
        const reservation = new ParkingReservation({
          user_id: userId,
          parking_space_id: parkingSpaceId,
          reservation_date: reservationDate,
          time_period: timePeriod,
          status: 'active',
        });

        const createdReservation = await this.reservationRepository.create(reservation);
        results.successful.push(createdReservation.toJSON());
      } catch (error) {
        results.failed.push({ parkingSpaceId, reason: error.message });
        results.errors.push(`Parking space ${parkingSpaceId}: ${error.message}`);
      }
    }

    if (results.successful.length === 0) {
      throw new Error(`Failed to reserve any parking spaces: ${results.errors.join('; ')}`);
    }

    return results;
  }
}

module.exports = ParkingReservationService;

