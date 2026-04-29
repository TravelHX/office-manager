// Phase 27b: admin endpoints for the Key Fob inventory + reports.
// Mounted under /api/admin/fob in src/backend/routes/index.js.
//
// Authorization: every endpoint requires either Administrator or
// Office Administrator (per spec section 22 — fob configuration is an
// Office Administrator capability).

const express = require('express');
const router = express.Router();

const FobInventoryService = require('../services/FobInventoryService');
const BookingRepository = require('../repositories/BookingRepository');
const { authenticate, authorize, requireCompleteProfile } = require('../middleware/auth');
const audit = require('../utils/audit-helper');

const fobInventoryService = new FobInventoryService();
const bookingRepository = new BookingRepository();

const oaOrAdmin = authorize(['admin', 'office_admin']);

/**
 * GET /api/admin/fob/inventory
 * Returns the current default count and the full list of per-date
 * overrides. `default` is `null` when no default has been configured
 * (the server-side never blocks fob requests in that case).
 */
router.get('/inventory', authenticate, requireCompleteProfile, oaOrAdmin, async (req, res, next) => {
  try {
    const def = await fobInventoryService.getDefault();
    const overrides = await fobInventoryService.fobInventoryRepository.getAllOverrides();
    res.json({
      default: def,
      overrides,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/fob/inventory/default  body { count }
 * Set the default daily fob count. Validation lives in the service.
 */
router.put('/inventory/default', authenticate, requireCompleteProfile, oaOrAdmin, async (req, res, next) => {
  try {
    const { count } = req.body || {};
    if (count === undefined || count === null) {
      return res.status(400).json({
        error: { message: 'Count is required', code: 'MISSING_COUNT' },
      });
    }
    const previous = await fobInventoryService.getDefault();
    const next = await fobInventoryService.setDefault(parseInt(count, 10), req.user.id);

    await audit.emit(req, {
      actionType: 'FOB_INVENTORY_DEFAULT_UPDATED',
      targetType: 'fob_inventory',
      summary: previous === null
        ? `Set default fob count to ${next.count}`
        : `Default fob count ${previous} → ${next.count}`,
      payload: {
        previous_count: previous,
        new_count: next.count,
      },
    });

    res.json({ count: next.count });
  } catch (error) {
    if (/non-negative|integer|number/i.test(error.message)) {
      return res.status(400).json({
        error: { message: error.message, code: 'INVALID_COUNT' },
      });
    }
    next(error);
  }
});

/**
 * PUT /api/admin/fob/inventory/:date  body { count }
 * Set a per-date override.
 */
router.put('/inventory/:date', authenticate, requireCompleteProfile, oaOrAdmin, async (req, res, next) => {
  try {
    const { date } = req.params;
    const { count } = req.body || {};
    if (count === undefined || count === null) {
      return res.status(400).json({
        error: { message: 'Count is required', code: 'MISSING_COUNT' },
      });
    }
    const previous = await fobInventoryService.getOverrideForDate(date);
    const next = await fobInventoryService.setOverride(date, parseInt(count, 10), req.user.id);

    await audit.emit(req, {
      actionType: 'FOB_INVENTORY_OVERRIDE_SET',
      targetType: 'fob_inventory',
      summary: previous === null
        ? `Set fob override for ${date} = ${next.count}`
        : `Fob override for ${date}: ${previous} → ${next.count}`,
      payload: {
        date,
        previous_count: previous,
        new_count: next.count,
      },
    });

    res.json({ date: next.date, count: next.count });
  } catch (error) {
    if (/Invalid date/.test(error.message)) {
      return res.status(400).json({
        error: { message: error.message, code: 'INVALID_DATE' },
      });
    }
    if (/non-negative|integer|number/i.test(error.message)) {
      return res.status(400).json({
        error: { message: error.message, code: 'INVALID_COUNT' },
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/admin/fob/inventory/:date
 * Remove a per-date override (silently no-ops if the override doesn't
 * exist, matching the existing repository contract).
 */
router.delete('/inventory/:date', authenticate, requireCompleteProfile, oaOrAdmin, async (req, res, next) => {
  try {
    const { date } = req.params;
    await fobInventoryService.removeOverride(date, req.user.id);

    await audit.emit(req, {
      actionType: 'FOB_INVENTORY_OVERRIDE_REMOVED',
      targetType: 'fob_inventory',
      summary: `Removed fob override for ${date}`,
      payload: { date },
    });

    res.status(204).send();
  } catch (error) {
    if (/Invalid date/.test(error.message)) {
      return res.status(400).json({
        error: { message: error.message, code: 'INVALID_DATE' },
      });
    }
    next(error);
  }
});

/**
 * GET /api/admin/fob/calendar?startDate&endDate
 * Per-day required-vs-available report. Empty range produces []; the
 * caller (Fob Calendar UI) can pick a default range like the current
 * month.
 */
router.get('/calendar', authenticate, requireCompleteProfile, oaOrAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query || {};
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'startDate and endDate are required',
          code: 'MISSING_DATE_RANGE',
        },
      });
    }
    const series = await fobInventoryService.getAvailabilityForRange(startDate, endDate);
    res.json({ startDate, endDate, days: series });
  } catch (error) {
    if (/Invalid date|Start date must/.test(error.message)) {
      return res.status(400).json({
        error: { message: error.message, code: 'INVALID_DATE_RANGE' },
      });
    }
    next(error);
  }
});

/**
 * GET /api/admin/fob/history?startDate&endDate&format=csv
 * Past-allocation report. Returns JSON by default; pass `format=csv`
 * for a downloadable CSV with the same columns. Cancelled fob bookings
 * are included so the report shows the full allocation history.
 */
router.get('/history', authenticate, requireCompleteProfile, oaOrAdmin, async (req, res, next) => {
  try {
    const { startDate, endDate, format } = req.query || {};
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'startDate and endDate are required',
          code: 'MISSING_DATE_RANGE',
        },
      });
    }
    if (startDate > endDate) {
      return res.status(400).json({
        error: { message: 'Start date must be on or before end date', code: 'INVALID_DATE_RANGE' },
      });
    }

    const rows = await bookingRepository.findFobBookingsHistoryInRange(startDate, endDate);

    if (format === 'csv') {
      const header = [
        'booking_id',
        'user_email',
        'user_name',
        'desk_number',
        'start_date',
        'end_date',
        'status',
      ].join(',');
      const lines = rows.map((r) => [
        r.id,
        csvEscape(r.userEmail),
        csvEscape(r.userName),
        csvEscape(r.deskNumber),
        csvEscape(formatDate(r.startDate)),
        csvEscape(formatDate(r.endDate)),
        csvEscape(r.status),
      ].join(','));
      const csv = [header, ...lines].join('\n');
      res
        .setHeader('Content-Type', 'text/csv; charset=utf-8')
        .setHeader(
          'Content-Disposition',
          `attachment; filename="fob-history-${startDate}-to-${endDate}.csv"`
        )
        .send(csv);
      return;
    }

    res.json({
      startDate,
      endDate,
      rows: rows.map((r) => ({
        ...r,
        startDate: formatDate(r.startDate),
        endDate: formatDate(r.endDate),
      })),
    });
  } catch (error) {
    next(error);
  }
});

/** Minimal CSV cell escaping: wrap in quotes when needed; double-up quotes. */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Coerce a Date or a YYYY-MM-DD string to a stable YYYY-MM-DD. */
function formatDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length >= 10 ? value.substring(0, 10) : value;
  if (value instanceof Date) {
    const yyyy = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(value.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(value);
}

module.exports = router;
