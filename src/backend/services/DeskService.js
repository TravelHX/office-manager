const DeskRepository = require('../repositories/DeskRepository');
const BookingRepository = require('../repositories/BookingRepository');
const Desk = require('../models/Desk');

class DeskService {
  constructor() {
    this.deskRepository = new DeskRepository();
    this.bookingRepository = new BookingRepository();
  }

  async getAllDesks() {
    return await this.deskRepository.findAllActive();
  }

  async getDeskById(id) {
    const desk = await this.deskRepository.findById(id);
    if (!desk) {
      throw new Error('Desk not found');
    }
    return desk;
  }

  async createDesk(deskData) {
    const existingDesk = await this.deskRepository.findByDeskNumber(deskData.deskNumber);
    if (existingDesk) {
      throw new Error('Desk with this number already exists');
    }

    const desk = new Desk({
      desk_number: deskData.deskNumber,
      location: deskData.location,
      description: deskData.description,
      is_active: deskData.isActive !== undefined ? deskData.isActive : true,
    });

    return await this.deskRepository.create(desk);
  }

  async updateDesk(id, deskData) {
    const existingDesk = await this.deskRepository.findById(id);
    if (!existingDesk) {
      throw new Error('Desk not found');
    }

    if (deskData.deskNumber && deskData.deskNumber !== existingDesk.deskNumber) {
      const deskWithNumber = await this.deskRepository.findByDeskNumber(deskData.deskNumber);
      if (deskWithNumber && deskWithNumber.id !== id) {
        throw new Error('Desk with this number already exists');
      }
    }

    const updatedDesk = new Desk({
      ...existingDesk.toJSON(),
      ...deskData,
    });

    return await this.deskRepository.update(id, updatedDesk);
  }

  async deleteDesk(id) {
    const desk = await this.deskRepository.findById(id);
    if (!desk) {
      throw new Error('Desk not found');
    }

    const activeBookings = await this.bookingRepository.findActiveByDeskId(id);
    if (activeBookings.length > 0) {
      throw new Error('Cannot delete desk with active bookings');
    }

    await this.deskRepository.delete(id);
    return true;
  }

  async getAvailableDesks(startDate, endDate) {
    const allDesks = await this.deskRepository.findAllActive();
    const availableDesks = [];

    for (const desk of allDesks) {
      const conflicts = await this.bookingRepository.findConflictingBookings(
        desk.id,
        startDate,
        endDate
      );
      if (conflicts.length === 0) {
        availableDesks.push(desk);
      }
    }

    return availableDesks;
  }

  async getAvailabilityInfo(startDate, endDate) {
    const allDesks = await this.deskRepository.findAllActive();
    const availableDesks = await this.getAvailableDesks(startDate, endDate);
    const totalDesks = allDesks.length;
    const remainingDesks = availableDesks.length;

    return {
      availableDesks,
      totalDesks,
      remainingDesks,
      bookedDesks: totalDesks - remainingDesks,
    };
  }

  async checkDeskAvailability(deskId, startDate, endDate, excludeBookingId = null) {
    const desk = await this.deskRepository.findById(deskId);
    if (!desk) {
      throw new Error('Desk not found');
    }

    if (!desk.isActive) {
      return { available: false, reason: 'Desk is not active' };
    }

    const conflicts = await this.bookingRepository.findConflictingBookings(
      deskId,
      startDate,
      endDate,
      excludeBookingId
    );

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map(b => b.toJSON()),
    };
  }
}

module.exports = DeskService;

