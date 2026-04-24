// Admin-only audit log reader (Phase 21b).
//
//   GET /api/admin/audit-events[?search=...&limit=...&offset=...]
//
// Returns `{ events, limit, offset }` where `events` is an array of AuditEvent
// JSON (camelCase, payload already parsed). Caller must be an authenticated
// admin with a completed profile; see middleware chain below. The endpoint
// is read-only — audit rows are append-only (see AuditEventRepository).

const express = require('express');
const router = express.Router();

const AuditService = require('../services/AuditService');
const { authenticate, authorize, requireCompleteProfile } = require('../middleware/auth');

const auditService = new AuditService();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;
const DEFAULT_OFFSET = 0;

/**
 * Parse and validate `limit` / `offset` query parameters.
 * @returns {{ ok: true, limit: number, offset: number } | { ok: false, message: string }}
 */
function parsePagination(query) {
  let limit = DEFAULT_LIMIT;
  let offset = DEFAULT_OFFSET;

  if (query.limit !== undefined) {
    const parsed = Number(query.limit);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, message: 'limit must be a non-negative integer' };
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  if (query.offset !== undefined) {
    const parsed = Number(query.offset);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
      return { ok: false, message: 'offset must be a non-negative integer' };
    }
    offset = parsed;
  }

  return { ok: true, limit, offset };
}

router.get(
  '/',
  authenticate,
  requireCompleteProfile,
  authorize(['admin']),
  async (req, res, next) => {
    try {
      const pagination = parsePagination(req.query);
      if (!pagination.ok) {
        return res.status(400).json({
          error: {
            message: pagination.message,
            code: 'INVALID_PAGINATION',
          },
        });
      }

      const { limit, offset } = pagination;
      const searchQuery = typeof req.query.search === 'string' ? req.query.search : '';

      const events = searchQuery.trim()
        ? await auditService.searchEvents({ query: searchQuery, limit, offset })
        : await auditService.getEvents({ limit, offset });

      res.json({
        events: events.map((event) => event.toJSON()),
        limit,
        offset,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
