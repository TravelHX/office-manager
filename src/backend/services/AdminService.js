const AdminConfigurationRepository = require('../repositories/AdminConfigurationRepository');
const DeskRepository = require('../repositories/DeskRepository');
const BookingRepository = require('../repositories/BookingRepository');
const ParkingSpaceRepository = require('../repositories/ParkingSpaceRepository');
const ParkingReservationRepository = require('../repositories/ParkingReservationRepository');
const Desk = require('../models/Desk');
const ParkingSpace = require('../models/ParkingSpace');

class AdminService {
  constructor() {
    this.configRepository = new AdminConfigurationRepository();
    this.deskRepository = new DeskRepository();
    this.bookingRepository = new BookingRepository();
    this.parkingSpaceRepository = new ParkingSpaceRepository();
    this.reservationRepository = new ParkingReservationRepository();
  }

  async getConfiguration() {
    const deskCount = await this.configRepository.getDeskCount();
    const parkingCount = await this.configRepository.getParkingCount();
    
    return {
      deskCount,
      parkingCount,
    };
  }

  async updateDeskCount(newCount) {
    if (newCount < 0) {
      throw new Error('Desk count cannot be negative');
    }

    if (!Number.isInteger(newCount)) {
      throw new Error('Desk count must be an integer');
    }

    const currentDesks = await this.deskRepository.findAllActive();
    const activeDeskCount = currentDesks.length;

    if (newCount < activeDeskCount) {
      throw new Error(`Cannot reduce desk count below ${activeDeskCount} (current active desks)`);
    }

    const activeBookings = await this.bookingRepository.findAll();
    const uniqueDesksWithBookings = new Set(activeBookings
      .filter(b => b.status === 'active')
      .map(b => b.deskId));
    
    if (newCount < uniqueDesksWithBookings.size) {
      throw new Error(`Cannot reduce desk count below ${uniqueDesksWithBookings.size} (desks with active bookings)`);
    }

    await this.configRepository.setDeskCount(newCount);

    const currentCount = currentDesks.length;
    if (newCount > currentCount) {
      for (let i = currentCount + 1; i <= newCount; i++) {
        const deskNumber = `D${String(i).padStart(3, '0')}`;
        const existingDesk = await this.deskRepository.findByDeskNumber(deskNumber);
        if (!existingDesk) {
          const desk = new Desk({
            desk_number: deskNumber,
            location: 'Office',
            description: `Desk ${deskNumber}`,
            is_active: true,
          });
          await this.deskRepository.create(desk);
        }
      }
    } else if (newCount < currentCount) {
      const desksToDeactivate = currentDesks.slice(newCount);
      for (const desk of desksToDeactivate) {
        const activeBookings = await this.bookingRepository.findActiveByDeskId(desk.id);
        if (activeBookings.length === 0) {
          await this.deskRepository.update(desk.id, { isActive: false });
        }
      }
    }

    return await this.getConfiguration();
  }

  async updateParkingCount(newCount) {
    if (newCount < 0) {
      throw new Error('Parking count cannot be negative');
    }

    if (!Number.isInteger(newCount)) {
      throw new Error('Parking count must be an integer');
    }

    const currentSpaces = await this.parkingSpaceRepository.findAllActive();
    const activeSpaceCount = currentSpaces.length;

    if (newCount < activeSpaceCount) {
      throw new Error(`Cannot reduce parking count below ${activeSpaceCount} (current active parking spaces)`);
    }

    const activeReservations = await this.reservationRepository.findAll();
    const uniqueSpacesWithReservations = new Set(activeReservations
      .filter(r => r.status === 'active')
      .map(r => r.parkingSpaceId));
    
    if (newCount < uniqueSpacesWithReservations.size) {
      throw new Error(`Cannot reduce parking count below ${uniqueSpacesWithReservations.size} (parking spaces with active reservations)`);
    }

    await this.configRepository.setParkingCount(newCount);

    const currentCount = currentSpaces.length;
    if (newCount > currentCount) {
      for (let i = currentCount + 1; i <= newCount; i++) {
        const spaceNumber = `P${String(i).padStart(3, '0')}`;
        const existingSpace = await this.parkingSpaceRepository.findBySpaceNumber(spaceNumber);
        if (!existingSpace) {
          const parkingSpace = new ParkingSpace({
            space_number: spaceNumber,
            location: 'Parking Lot',
            description: `Parking Space ${spaceNumber}`,
            is_active: true,
          });
          await this.parkingSpaceRepository.create(parkingSpace);
        }
      }
    } else if (newCount < currentCount) {
      const spacesToDeactivate = currentSpaces.slice(newCount);
      for (const space of spacesToDeactivate) {
        const activeReservations = await this.reservationRepository.findActiveByParkingSpaceId(space.id);
        if (activeReservations.length === 0) {
          await this.parkingSpaceRepository.update(space.id, { isActive: false });
        }
      }
    }

    return await this.getConfiguration();
  }

  async getAllBookings() {
    return await this.bookingRepository.findAll();
  }

  async getAllParkingReservations() {
    return await this.reservationRepository.findAll();
  }

  async getAllOvertimeRecords() {
    const OvertimeRecordRepository = require('../repositories/OvertimeRecordRepository');
    const overtimeRepository = new OvertimeRecordRepository();
    return await overtimeRepository.findAll();
  }
}

module.exports = AdminService;

