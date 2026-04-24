const express = require('express');
const router = express.Router();
const AdminService = require('../services/AdminService');
const BookingService = require('../services/BookingService');
const ParkingReservationService = require('../services/ParkingReservationService');
const { authenticate, authorize, requireCompleteProfile } = require('../middleware/auth');

const adminService = new AdminService();
const bookingService = new BookingService();
const reservationService = new ParkingReservationService();

router.get('/configuration', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const config = await adminService.getConfiguration();
    res.json(config);
  } catch (error) {
    next(error);
  }
});

router.put('/configuration/desk-count', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const { deskCount, numberingMode = 'auto', startNumber = 1 } = req.body;
    
    if (deskCount === undefined || deskCount === null) {
      return res.status(400).json({
        error: {
          message: 'Desk count is required',
          code: 'MISSING_DESK_COUNT',
        },
      });
    }

    const config = await adminService.updateDeskCount(parseInt(deskCount), numberingMode, parseInt(startNumber));
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

router.put('/configuration/parking-count', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const { parkingCount, numberingMode = 'auto', startNumber = 1 } = req.body;
    
    if (parkingCount === undefined || parkingCount === null) {
      return res.status(400).json({
        error: {
          message: 'Parking count is required',
          code: 'MISSING_PARKING_COUNT',
        },
      });
    }

    const config = await adminService.updateParkingCount(parseInt(parkingCount), numberingMode, parseInt(startNumber));
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

router.get('/bookings', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const bookings = await adminService.getAllBookings();
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

router.get('/parking-reservations', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const reservations = await adminService.getAllParkingReservations();
    res.json(reservations);
  } catch (error) {
    next(error);
  }
});

router.get('/desks', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const desks = await adminService.getAllDesks();
    res.json(desks.map(d => d.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.get('/parking-spaces', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const spaces = await adminService.getAllParkingSpaces();
    res.json(spaces.map(s => s.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.delete('/bookings/:id', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
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

router.delete('/parking-reservations/:id', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
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

// Bulk desk creation endpoint
router.post('/desks/bulk', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const { count, numberingMode = 'auto', startNumber = 1 } = req.body;
    
    if (!count || count <= 0) {
      return res.status(400).json({
        error: {
          message: 'Count must be greater than 0',
          code: 'INVALID_COUNT',
        },
      });
    }

    const desks = await adminService.createDesksBulk(parseInt(count), numberingMode, parseInt(startNumber));
    res.status(201).json(desks.map(d => d.toJSON()));
  } catch (error) {
    if (error.message.includes('already assigned') || error.message.includes('greater than 0')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_REQUEST',
        },
      });
    }
    next(error);
  }
});

// Bulk parking space creation endpoint
router.post('/parking-spaces/bulk', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const { count, numberingMode = 'auto', startNumber = 1 } = req.body;
    
    if (!count || count <= 0) {
      return res.status(400).json({
        error: {
          message: 'Count must be greater than 0',
          code: 'INVALID_COUNT',
        },
      });
    }

    const spaces = await adminService.createParkingSpacesBulk(parseInt(count), numberingMode, parseInt(startNumber));
    res.status(201).json(spaces.map(s => s.toJSON()));
  } catch (error) {
    if (error.message.includes('already assigned') || error.message.includes('greater than 0')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_REQUEST',
        },
      });
    }
    next(error);
  }
});

// Manual desk number assignment endpoint
router.put('/desks/:id/number', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const { deskNumber } = req.body;
    
    if (!deskNumber) {
      return res.status(400).json({
        error: {
          message: 'Desk number is required',
          code: 'MISSING_DESK_NUMBER',
        },
      });
    }

    const desk = await adminService.assignDeskNumber(parseInt(req.params.id), deskNumber);
    res.json(desk.toJSON());
  } catch (error) {
    if (error.message === 'Desk not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'DESK_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already assigned') || error.message.includes('cannot be empty')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_DESK_NUMBER',
        },
      });
    }
    next(error);
  }
});

// Manual parking space number assignment endpoint
router.put('/parking-spaces/:id/number', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const { spaceNumber } = req.body;
    
    if (!spaceNumber) {
      return res.status(400).json({
        error: {
          message: 'Parking space number is required',
          code: 'MISSING_SPACE_NUMBER',
        },
      });
    }

    const space = await adminService.assignParkingSpaceNumber(parseInt(req.params.id), spaceNumber);
    res.json(space.toJSON());
  } catch (error) {
    if (error.message === 'Parking space not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already assigned') || error.message.includes('cannot be empty')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_SPACE_NUMBER',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

