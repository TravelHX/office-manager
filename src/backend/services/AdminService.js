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

  async updateDeskCount(newCount, numberingMode = 'auto', startNumber = 1) {
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
      await this.createDesksBulk(newCount - currentCount, numberingMode, startNumber + currentCount);
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

  async createDesksBulk(count, numberingMode = 'auto', startNumber = 1) {
    if (count <= 0) {
      throw new Error('Count must be greater than 0');
    }

    const createdDesks = [];
    for (let i = 0; i < count; i++) {
      let deskNumber;
      if (numberingMode === 'auto') {
        // Sequential numbering: 1, 2, 3, ...
        deskNumber = String(startNumber + i);
      } else {
        // Legacy format: D001, D002, ...
        deskNumber = `D${String(startNumber + i).padStart(3, '0')}`;
      }

      const existingDesk = await this.deskRepository.findByDeskNumber(deskNumber);
      if (!existingDesk) {
        const desk = new Desk({
          desk_number: deskNumber,
          location: 'Office',
          description: `Desk ${deskNumber}`,
          is_active: true,
        });
        const created = await this.deskRepository.create(desk);
        createdDesks.push(created);
      }
    }
    return createdDesks;
  }

  async assignDeskNumber(deskId, deskNumber) {
    if (!deskNumber || deskNumber.trim() === '') {
      throw new Error('Desk number cannot be empty');
    }

    const existingDesk = await this.deskRepository.findByDeskNumber(deskNumber.trim());
    if (existingDesk && existingDesk.id !== deskId) {
      throw new Error(`Desk number ${deskNumber} is already assigned`);
    }

    const desk = await this.deskRepository.findById(deskId);
    if (!desk) {
      throw new Error('Desk not found');
    }

    const updatedDesk = new Desk({
      id: desk.id,
      desk_number: deskNumber.trim(),
      location: desk.location,
      description: desk.description,
      is_active: desk.isActive ? 1 : 0,
      created_at: desk.createdAt,
      updated_at: desk.updatedAt,
    });
    return await this.deskRepository.update(deskId, updatedDesk);
  }

  async updateParkingCount(newCount, numberingMode = 'auto', startNumber = 1) {
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
      await this.createParkingSpacesBulk(newCount - currentCount, numberingMode, startNumber + currentCount);
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

  async createParkingSpacesBulk(count, numberingMode = 'auto', startNumber = 1) {
    if (count <= 0) {
      throw new Error('Count must be greater than 0');
    }

    const createdSpaces = [];
    for (let i = 0; i < count; i++) {
      let spaceNumber;
      if (numberingMode === 'auto') {
        // Sequential numbering: 1, 2, 3, ...
        spaceNumber = String(startNumber + i);
      } else {
        // Legacy format: P001, P002, ...
        spaceNumber = `P${String(startNumber + i).padStart(3, '0')}`;
      }

      const existingSpace = await this.parkingSpaceRepository.findBySpaceNumber(spaceNumber);
      if (!existingSpace) {
        const parkingSpace = new ParkingSpace({
          space_number: spaceNumber,
          location: 'Parking Lot',
          description: `Parking Space ${spaceNumber}`,
          is_active: true,
        });
        const created = await this.parkingSpaceRepository.create(parkingSpace);
        createdSpaces.push(created);
      }
    }
    return createdSpaces;
  }

  async assignParkingSpaceNumber(spaceId, spaceNumber) {
    if (!spaceNumber || spaceNumber.trim() === '') {
      throw new Error('Parking space number cannot be empty');
    }

    const existingSpace = await this.parkingSpaceRepository.findBySpaceNumber(spaceNumber.trim());
    if (existingSpace && existingSpace.id !== spaceId) {
      throw new Error(`Parking space number ${spaceNumber} is already assigned`);
    }

    const space = await this.parkingSpaceRepository.findById(spaceId);
    if (!space) {
      throw new Error('Parking space not found');
    }

    const updatedSpace = new ParkingSpace({
      id: space.id,
      space_number: spaceNumber.trim(),
      location: space.location,
      description: space.description,
      is_active: space.isActive ? 1 : 0,
      created_at: space.createdAt,
      updated_at: space.updatedAt,
    });
    return await this.parkingSpaceRepository.update(spaceId, updatedSpace);
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

  async getAllDesks() {
    return await this.deskRepository.findAll();
  }

  async getAllParkingSpaces() {
    return await this.parkingSpaceRepository.findAll();
  }
}

module.exports = AdminService;

