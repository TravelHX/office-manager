const express = require('express');
const router = express.Router();
const AdminService = require('../services/AdminService');
const BookingService = require('../services/BookingService');
const ParkingReservationService = require('../services/ParkingReservationService');
const { authenticate, authorize } = require('../middleware/auth');

const adminService = new AdminService();
const bookingService = new BookingService();
const reservationService = new ParkingReservationService();

router.get('/configuration', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const config = await adminService.getConfiguration();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.put('/configuration/desk-count', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { deskCount } = req.body;
    
    if (deskCount === undefined || deskCount === null) {
      return res.status(400).json({
        error: {
          message: 'Desk count is required',
          code: 'MISSING_DESK_COUNT',
        },
      });
    }

    const config = await adminService.updateDeskCount(parseInt(deskCount));
    res.json(config);
  } catch (error) {
    if (error.message.includes('cannot reduce') || error.message.includes('negative') || error.message.includes('integer')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_DESK_COUNT',
        },
      });
    }
    next(error);
  }
});

router.put('/configuration/parking-count', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { parkingCount } = req.body;
    
    if (parkingCount === undefined || parkingCount === null) {
      return res.status(400).json({
        error: {
          message: 'Parking count is required',
          code: 'MISSING_PARKING_COUNT',
        },
      });
    }

    const config = await adminService.updateParkingCount(parseInt(parkingCount));
    res.json(config);
  } catch (error) {
    if (error.message.includes('cannot reduce') || error.message.includes('negative') || error.message.includes('integer')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_PARKING_COUNT',
        },
      });
    }
    next(error);
  }
});

router.get('/bookings', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const bookings = await adminService.getAllBookings();
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

router.get('/parking-reservations', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const reservations = await adminService.getAllParkingReservations();
    res.json(reservations);
  } catch (error) {
    next(error);
  }
});

router.get('/overtime-records', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const records = await adminService.getAllOvertimeRecords();
    res.json(records);
  } catch (error) {
    next(error);
  }
});

router.delete('/bookings/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { reason } = req.body;
    
    await bookingService.cancelBooking(parseInt(req.params.id), adminId, reason || null);
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Booking not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'BOOKING_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already cancelled')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'ALREADY_CANCELLED',
        },
      });
    }
    next(error);
  }
});

router.delete('/parking-reservations/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { reason } = req.body;
    
    await reservationService.cancelReservation(parseInt(req.params.id), adminId, reason || null);
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Reservation not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'RESERVATION_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already cancelled')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'ALREADY_CANCELLED',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

