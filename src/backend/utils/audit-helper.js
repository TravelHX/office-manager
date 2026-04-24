// audit-helper.js — thin wrapper over AuditService for emitting events from
// route handlers. Phase 21d.
//
// Why this lives in utils, not services:
//   Emission is a cross-cutting concern for routes. Routes have `req.user`
//   and `req.ip`; services don't. Rather than thread request context through
//   every service call, routes call `emit(req, { actionType, ... })` after
//   a successful mutation and before responding.
//
// Failure semantics:
//   Audit writes MUST NOT break the user-facing action. Any error inside
//   `emit` is caught, logged to the standard logger at WARN level, and
//   swallowed. If the audit DB is down or the schema drifts, the feature
//   the user was exercising still succeeds. Losing an audit row is bad
//   but less bad than breaking bookings.
//
// Actor defaults:
//   - actorId:    req.user.id if the request is authenticated
//   - actorEmail: req.user.username (the app uses email-as-username)
//   - ipAddress:  req.ip (Express resolves this for us)
//   Callers can override any field explicitly, which is needed for:
//     - AUTH_LOGIN_FAILURE (actor is system, but attempted_email is in payload)
//     - USER_CREATED on self-registration (actor is the newly-created user
//       themselves, not the anonymous request that came in)

const AuditService = require('../services/AuditService');
const logger = require('./logger');

const auditService = new AuditService();

/**
 * Emit an audit event scoped to the request's context. Never throws.
 *
 * @param {import('express').Request|null} req    Express request; may be null
 *                                                for out-of-band emissions.
 * @param {Object} params                          Event fields; overrides
 *                                                 anything pulled from req.
 * @param {string} params.actionType               Required; see docs/audit-events.md.
 * @param {number|null} [params.actorId]
 * @param {string|null} [params.actorEmail]
 * @param {string|null} [params.targetType]
 * @param {number|null} [params.targetId]
 * @param {string|null} [params.summary]
 * @param {Object|null} [params.payload]
 * @param {string|null} [params.ipAddress]
 * @returns {Promise<void>} Resolves after the write attempt, regardless of outcome.
 */
async function emit(req, params = {}) {
  try {
    if (!params || typeof params.actionType !== 'string' || !params.actionType) {
      logger.warn('audit-helper: emit called without actionType; skipping');
      return;
    }

    const reqUser = req && req.user;
    const defaults = {
      actorId: reqUser ? reqUser.id : null,
      // The application uses email-as-username. `username` on req.user is the
      // email; we record it as `actor_email` for audit provenance.
      actorEmail: reqUser ? (reqUser.username || null) : null,
      ipAddress: req && typeof req.ip === 'string' && req.ip ? req.ip : null,
    };

    const merged = {
      actionType: params.actionType,
      actorId: params.actorId !== undefined ? params.actorId : defaults.actorId,
      actorEmail: params.actorEmail !== undefined ? params.actorEmail : defaults.actorEmail,
      targetType: params.targetType !== undefined ? params.targetType : null,
      targetId: params.targetId !== undefined ? params.targetId : null,
      summary: params.summary !== undefined ? params.summary : null,
      payload: params.payload !== undefined ? params.payload : null,
      ipAddress: params.ipAddress !== undefined ? params.ipAddress : defaults.ipAddress,
    };

    await auditService.logEvent(merged);
  } catch (error) {
    // Never let audit failures bubble up into request handlers.
    logger.warn(
      `audit-helper: failed to record audit event '${params && params.actionType}': ${error.message}`
    );
  }
}

module.exports = {
  emit,
  // Exposed for tests that want to exercise the shared instance.
  _auditService: auditService,
};
