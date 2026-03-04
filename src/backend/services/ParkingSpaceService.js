const ParkingSpaceRepository = require('../repositories/ParkingSpaceRepository');
const ParkingReservationRepository = require('../repositories/ParkingReservationRepository');
const ParkingSpace = require('../models/ParkingSpace');

class ParkingSpaceService {
  constructor() {
    this.parkingSpaceRepository = new ParkingSpaceRepository();
    this.reservationRepository = new ParkingReservationRepository();
  }

  async getAllParkingSpaces() {
    return await this.parkingSpaceRepository.findAllActive();
  }

  async getParkingSpaceById(id) {
    const parkingSpace = await this.parkingSpaceRepository.findById(id);
    if (!parkingSpace) {
      throw new Error('Parking space not found');
    }
    return parkingSpace;
  }

  async createParkingSpace(parkingSpaceData) {
    const existingSpace = await this.parkingSpaceRepository.findBySpaceNumber(parkingSpaceData.spaceNumber);
    if (existingSpace) {
      throw new Error('Parking space with this number already exists');
    }

    const parkingSpace = new ParkingSpace({
      space_number: parkingSpaceData.spaceNumber,
      location: parkingSpaceData.location,
      description: parkingSpaceData.description,
      is_active: parkingSpaceData.isActive !== undefined ? parkingSpaceData.isActive : true,
    });

    return await this.parkingSpaceRepository.create(parkingSpace);
  }

  async updateParkingSpace(id, parkingSpaceData) {
    const existingSpace = await this.parkingSpaceRepository.findById(id);
    if (!existingSpace) {
      throw new Error('Parking space not found');
    }

    if (parkingSpaceData.spaceNumber && parkingSpaceData.spaceNumber !== existingSpace.spaceNumber) {
      const spaceWithNumber = await this.parkingSpaceRepository.findBySpaceNumber(parkingSpaceData.spaceNumber);
      if (spaceWithNumber && spaceWithNumber.id !== id) {
        throw new Error('Parking space with this number already exists');
      }
    }

    const updatedSpace = new ParkingSpace({
      ...existingSpace.toJSON(),
      ...parkingSpaceData,
    });

    return await this.parkingSpaceRepository.update(id, updatedSpace);
  }

  async deleteParkingSpace(id) {
    const parkingSpace = await this.parkingSpaceRepository.findById(id);
    if (!parkingSpace) {
      throw new Error('Parking space not found');
    }

    const activeReservations = await this.reservationRepository.findActiveByParkingSpaceId(id);
    if (activeReservations.length > 0) {
      throw new Error('Cannot delete parking space with active reservations');
    }

    await this.parkingSpaceRepository.delete(id);
    return true;
  }

  async getAvailableParkingSpaces(reservationDate, timePeriod) {
    const allSpaces = await this.parkingSpaceRepository.findAllActive();
    const availableSpaces = [];

    for (const space of allSpaces) {
      const conflicts = await this.reservationRepository.findConflictingReservations(
        space.id,
        reservationDate,
        timePeriod
      );
      if (conflicts.length === 0) {
        availableSpaces.push(space);
      }
    }

    return availableSpaces;
  }

  async getAvailabilityInfo(reservationDate, timePeriod) {
    const allSpaces = await this.parkingSpaceRepository.findAllActive();
    const availableSpaces = await this.getAvailableParkingSpaces(reservationDate, timePeriod);
    const totalSpaces = allSpaces.length;
    const remainingSpaces = availableSpaces.length;

    return {
      availableSpaces,
      totalSpaces,
      remainingSpaces,
      bookedSpaces: totalSpaces - remainingSpaces,
    };
  }

  async checkParkingSpaceAvailability(parkingSpaceId, reservationDate, timePeriod, excludeReservationId = null) {
    const parkingSpace = await this.parkingSpaceRepository.findById(parkingSpaceId);
    if (!parkingSpace) {
      throw new Error('Parking space not found');
    }

    if (!parkingSpace.isActive) {
      return { available: false, reason: 'Parking space is not active' };
    }

    const conflicts = await this.reservationRepository.findConflictingReservations(
      parkingSpaceId,
      reservationDate,
      timePeriod,
      excludeReservationId
    );

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map(r => r.toJSON()),
    };
  }
}

module.exports = ParkingSpaceService;

