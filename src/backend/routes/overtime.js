const express = require('express');
const router = express.Router();
const OvertimeService = require('../services/OvertimeService');
const { authenticate, authorize, requireCompleteProfile } = require('../middleware/auth');

const overtimeService = new OvertimeService();

router.get('/my-overtime', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const records = await overtimeService.getUserOvertimeRecords(userId);
    res.json(records.map(r => r.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.get('/history', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Start date and end date are required',
          code: 'MISSING_DATES',
        },
      });
    }

    const records = await overtimeService.getUserOvertimeRecordsByDateRange(userId, startDate, endDate);
    res.json(records.map(r => r.toJSON()));
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

router.get('/report', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Start date and end date are required',
          code: 'MISSING_DATES',
        },
      });
    }

    const report = await overtimeService.getOvertimeReport(userId, startDate, endDate);
    res.json(report);
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

router.get('/pending', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const records = await overtimeService.getOvertimeRecordsByStatus('pending');
    res.json(records);
  } catch (error) {
    if (error.message.includes('Invalid status')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_STATUS',
        },
      });
    }
    next(error);
  }
});

router.get('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const record = await overtimeService.getOvertimeRecordById(parseInt(req.params.id));
    res.json(record.toJSON());
  } catch (error) {
    if (error.message === 'Overtime record not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'OVERTIME_RECORD_NOT_FOUND',
        },
      });
    }
    next(error);
  }
});

router.post('/', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { recordDate, startTime, endTime, description } = req.body;
    
    if (!recordDate || !startTime || !endTime) {
      return res.status(400).json({
        error: {
          message: 'Record date, start time, and end time are required',
          code: 'MISSING_PARAMETERS',
        },
      });
    }

    const record = await overtimeService.createOvertimeRecord(
      userId,
      recordDate,
      startTime,
      endTime,
      description
    );
    
    res.status(201).json(record.toJSON());
  } catch (error) {
    if (error.message.includes('time') || error.message.includes('date') || error.message.includes('hours')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_INPUT',
        },
      });
    }
    next(error);
  }
});

router.put('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { recordDate, startTime, endTime, description } = req.body;
    
    if (!recordDate || !startTime || !endTime) {
      return res.status(400).json({
        error: {
          message: 'Record date, start time, and end time are required',
          code: 'MISSING_PARAMETERS',
        },
      });
    }

    const record = await overtimeService.updateOvertimeRecord(
      parseInt(req.params.id),
      userId,
      recordDate,
      startTime,
      endTime,
      description
    );
    
    res.json(record.toJSON());
  } catch (error) {
    if (error.message === 'Overtime record not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'OVERTIME_RECORD_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('only update your own')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'FORBIDDEN',
        },
      });
    }
    if (error.message.includes('approved')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'CANNOT_UPDATE_APPROVED',
        },
      });
    }
    if (error.message.includes('time') || error.message.includes('date') || error.message.includes('hours')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_INPUT',
        },
      });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await overtimeService.deleteOvertimeRecord(parseInt(req.params.id), userId);
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Overtime record not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'OVERTIME_RECORD_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('only delete your own')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'FORBIDDEN',
        },
      });
    }
    if (error.message.includes('approved')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'CANNOT_DELETE_APPROVED',
        },
      });
    }
    next(error);
  }
});

router.post('/:id/approve', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const approvedBy = req.user.id;
    const record = await overtimeService.approveOvertimeRecord(parseInt(req.params.id), approvedBy);
    res.json(record.toJSON());
  } catch (error) {
    if (error.message === 'Overtime record not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'OVERTIME_RECORD_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already approved')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'ALREADY_APPROVED',
        },
      });
    }
    next(error);
  }
});

router.post('/:id/reject', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const approvedBy = req.user.id;
    const record = await overtimeService.rejectOvertimeRecord(parseInt(req.params.id), approvedBy);
    res.json(record.toJSON());
  } catch (error) {
    if (error.message === 'Overtime record not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'OVERTIME_RECORD_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already rejected')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'ALREADY_REJECTED',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

