const BookingRepository = require('../repositories/BookingRepository');
const DeskRepository = require('../repositories/DeskRepository');
const DeskService = require('./DeskService');
const Booking = require('../models/Booking');

class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.deskRepository = new DeskRepository();
    this.deskService = new DeskService();
  }

  async createBooking(userId, deskId, startDate, endDate) {
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new Error('Cannot book desks for past dates');
    }

    const desk = await this.deskRepository.findById(deskId);
    if (!desk) {
      throw new Error('Desk not found');
    }

    if (!desk.isActive) {
      throw new Error('Desk is not available');
    }

    const availability = await this.deskService.checkDeskAvailability(deskId, startDate, endDate);
    if (!availability.available) {
      throw new Error('Desk is not available for the selected date range');
    }

    const booking = new Booking({
      user_id: userId,
      desk_id: deskId,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
    });

    return await this.bookingRepository.create(booking);
  }

  async getBookingById(id) {
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new Error('Booking not found');
    }
    return booking;
  }

  async getUserBookings(userId) {
    return await this.bookingRepository.findByUserId(userId);
  }

  async getAllBookings() {
    return await this.bookingRepository.findAll();
  }

  async cancelBooking(bookingId, cancelledBy, reason = null) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    return await this.bookingRepository.cancel(bookingId, cancelledBy, reason);
  }

  async cancelUserBooking(bookingId, userId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new Error('You can only cancel your own bookings');
    }

    return await this.cancelBooking(bookingId, userId);
  }

  async checkAvailability(deskId, startDate, endDate) {
    return await this.deskService.checkDeskAvailability(deskId, startDate, endDate);
  }

  async getAvailableDesks(startDate, endDate) {
    return await this.deskService.getAvailableDesks(startDate, endDate);
  }
}

module.exports = BookingService;

