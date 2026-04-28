const express = require('express');
const router = express.Router();
const AdminService = require('../services/AdminService');
const BookingService = require('../services/BookingService');
const ParkingReservationService = require('../services/ParkingReservationService');
const { authenticate, authorize, requireCompleteProfile } = require('../middleware/auth');
const audit = require('../utils/audit-helper');

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

    const before = await adminService.getConfiguration();
    const config = await adminService.updateDeskCount(parseInt(deskCount), numberingMode, parseInt(startNumber));

    // Phase 21d (21.9): desk count changed. Emit a single aggregate event
    // rather than per-desk rows — bulk count changes happen rarely but
    // can create hundreds of desks at once.
    await audit.emit(req, {
      actionType: 'ADMIN_CONFIG_UPDATED',
      targetType: 'admin_config',
      summary: `Desk count ${before.deskCount} → ${config.deskCount}`,
      payload: {
        changed_keys: ['deskCount'],
        before: { deskCount: before.deskCount },
        after: { deskCount: config.deskCount },
        numbering_mode: numberingMode,
      },
    });

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

    const before = await adminService.getConfiguration();
    const config = await adminService.updateParkingCount(parseInt(parkingCount), numberingMode, parseInt(startNumber));

    // Phase 21d (21.9): parking count change — same pattern as desk count.
    await audit.emit(req, {
      actionType: 'ADMIN_CONFIG_UPDATED',
      targetType: 'admin_config',
      summary: `Parking count ${before.parkingCount} → ${config.parkingCount}`,
      payload: {
        changed_keys: ['parkingCount'],
        before: { parkingCount: before.parkingCount },
        after: { parkingCount: config.parkingCount },
        numbering_mode: numberingMode,
      },
    });

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

// Phase 26: Office Administrators can also cancel another user's desk
// booking. The previous `authorize(['admin'])` is widened to include
// 'office_admin'; the audit event records the actor's role so admin vs
// office-admin actions are distinguishable in the trail.
router.delete('/bookings/:id', authenticate, requireCompleteProfile, authorize(['admin', 'office_admin']), async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { reason } = req.body;
    const bookingId = parseInt(req.params.id);

    // Read the booking before cancellation so we can record which user's
    // booking was removed and for which desk.
    let preCancelBooking = null;
    try {
      preCancelBooking = await bookingService.getBookingById(bookingId);
    } catch (_) {
      // Ignore — service call below will surface the 404.
    }

    await bookingService.cancelBooking(bookingId, adminId, reason || null);

    // Phase 21d (21.7): admin-initiated cancel. Actor is the admin.
    await audit.emit(req, {
      actionType: 'DESK_BOOKING_CANCELLED_BY_ADMIN',
      targetType: 'booking',
      targetId: bookingId,
      summary: preCancelBooking
        ? `Admin cancelled booking #${bookingId} (desk ${preCancelBooking.deskId})`
        : `Admin cancelled booking #${bookingId}`,
      payload: {
        booking_user_id: preCancelBooking ? preCancelBooking.userId : null,
        desk_id: preCancelBooking ? preCancelBooking.deskId : null,
        reason: reason || null,
      },
    });

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

// Phase 26: Office Administrators can also cancel another user's parking
// reservation, parallel to the desk-booking cancel above.
router.delete('/parking-reservations/:id', authenticate, requireCompleteProfile, authorize(['admin', 'office_admin']), async (req, res, next) => {
  try {
    const adminId = req.user.id;
    const { reason } = req.body;
    const reservationId = parseInt(req.params.id);

    // Read the reservation before cancellation for the audit payload.
    let preCancelReservation = null;
    try {
      preCancelReservation = await reservationService.getReservationById(reservationId);
    } catch (_) {
      // Ignore — service call below will surface the 404.
    }

    await reservationService.cancelReservation(reservationId, adminId, reason || null);

    // Phase 21d (21.8): admin-initiated parking cancel.
    await audit.emit(req, {
      actionType: 'PARKING_RESERVATION_CANCELLED_BY_ADMIN',
      targetType: 'parking_reservation',
      targetId: reservationId,
      summary: preCancelReservation
        ? `Admin cancelled parking reservation #${reservationId} (space ${preCancelReservation.parkingSpaceId})`
        : `Admin cancelled parking reservation #${reservationId}`,
      payload: {
        reservation_user_id: preCancelReservation ? preCancelReservation.userId : null,
        parking_space_id: preCancelReservation ? preCancelReservation.parkingSpaceId : null,
        reason: reason || null,
      },
    });

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

    // Phase 21d (21.9): bulk desk creation — emit one aggregate event
    // rather than a row per desk, matching the approach used for bulk
    // count changes.
    await audit.emit(req, {
      actionType: 'ADMIN_CONFIG_UPDATED',
      targetType: 'admin_config',
      summary: `Admin bulk-created ${desks.length} desk(s)`,
      payload: {
        changed_keys: ['desks'],
        change: 'created',
        numbering_mode: numberingMode,
        start_number: parseInt(startNumber),
        created_count: desks.length,
        created_desk_numbers: desks.map(d => d.deskNumber),
      },
    });

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

    // Phase 21d (21.9): bulk parking-space creation — aggregate event.
    await audit.emit(req, {
      actionType: 'ADMIN_CONFIG_UPDATED',
      targetType: 'admin_config',
      summary: `Admin bulk-created ${spaces.length} parking space(s)`,
      payload: {
        changed_keys: ['parking_spaces'],
        change: 'created',
        numbering_mode: numberingMode,
        start_number: parseInt(startNumber),
        created_count: spaces.length,
        created_space_numbers: spaces.map(s => s.spaceNumber),
      },
    });

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

    const deskId = parseInt(req.params.id);

    // Capture the previous desk number for the audit payload. If the lookup
    // fails we still emit (with previous_desk_number=null); the service
    // call below will surface the proper 404 if the id is invalid.
    let previousDeskNumber = null;
    try {
      const existing = await adminService.deskRepository.findById(deskId);
      previousDeskNumber = existing ? existing.deskNumber : null;
    } catch (_) {
      // Non-fatal; audit tolerates null.
    }

    const desk = await adminService.assignDeskNumber(deskId, deskNumber);

    // Phase 21d (21.9): per-desk rename. Unlike bulk count changes, renames
    // are individual admin edits and rare enough to warrant one row each.
    await audit.emit(req, {
      actionType: 'DESK_CONFIG_UPDATED',
      targetType: 'desk',
      targetId: deskId,
      summary: `Admin renamed desk #${deskId} → ${desk.deskNumber}`,
      payload: {
        change: 'renamed',
        desk_number: desk.deskNumber,
        previous_desk_number: previousDeskNumber,
      },
    });

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

    const spaceId = parseInt(req.params.id);

    let previousSpaceNumber = null;
    try {
      const existing = await adminService.parkingSpaceRepository.findById(spaceId);
      previousSpaceNumber = existing ? existing.spaceNumber : null;
    } catch (_) {
      // Non-fatal; audit tolerates null.
    }

    const space = await adminService.assignParkingSpaceNumber(spaceId, spaceNumber);

    // Phase 21d (21.9): per-space rename.
    await audit.emit(req, {
      actionType: 'PARKING_CONFIG_UPDATED',
      targetType: 'parking_space',
      targetId: spaceId,
      summary: `Admin renamed parking space #${spaceId} → ${space.spaceNumber}`,
      payload: {
        change: 'renamed',
        space_number: space.spaceNumber,
        previous_space_number: previousSpaceNumber,
      },
    });

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

