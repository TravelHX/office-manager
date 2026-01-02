const express = require('express');
const router = express.Router();
const MatrixService = require('../services/MatrixService');
const { authenticate, authorize } = require('../middleware/auth');

const matrixService = new MatrixService();

// Get matrix data endpoint (admin only)
router.get('/bookings', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { startDate, endDate, userIds, deskIds, parkingSpaceIds, type } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Start date and end date are required',
          code: 'MISSING_DATES',
        },
      });
    }

    // Parse filter arrays if provided
    let userIdsArray = null;
    if (userIds) {
      try {
        userIdsArray = Array.isArray(userIds) ? userIds.map(id => parseInt(id)) : [parseInt(userIds)];
      } catch (error) {
        userIdsArray = null;
      }
    }

    let deskIdsArray = null;
    if (deskIds) {
      try {
        deskIdsArray = Array.isArray(deskIds) ? deskIds.map(id => parseInt(id)) : [parseInt(deskIds)];
      } catch (error) {
        deskIdsArray = null;
      }
    }

    let parkingSpaceIdsArray = null;
    if (parkingSpaceIds) {
      try {
        parkingSpaceIdsArray = Array.isArray(parkingSpaceIds)
          ? parkingSpaceIds.map(id => parseInt(id))
          : [parseInt(parkingSpaceIds)];
      } catch (error) {
        parkingSpaceIdsArray = null;
      }
    }

    // Validate type
    const validTypes = ['desks', 'parking', 'combined'];
    const matrixType = validTypes.includes(type) ? type : 'combined';

    const matrixData = await matrixService.getMatrixData({
      startDate,
      endDate,
      userIds: userIdsArray,
      deskIds: deskIdsArray,
      parkingSpaceIds: parkingSpaceIdsArray,
      type: matrixType,
    });

    res.json(matrixData);
  } catch (error) {
    if (error.message.includes('date')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_DATE',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

