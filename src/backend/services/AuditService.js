// AuditService — thin coordinator over AuditEventRepository that is called
// by mutating flows (Phase 21d) to record what happened. In Phase 21a this
// service exists and is fully unit-tested, but no application code calls
// logEvent yet; the catalogue of events and when to emit them lives in
// docs/audit-events.md.
//
// Design notes:
//   - Callers pass camelCase fields; the model converts to snake_case for
//     the INSERT. This keeps emission sites readable.
//   - All state-mutating surface in AuditEventRepository is append-only;
//     the service exposes only log/read methods. There is no deleteEvent,
//     no updateEvent.
//   - `payload` is stored as JSON. Callers MUST NOT include secrets; see
//     docs/audit-events.md § "Payload hygiene".

const AuditEventRepository = require('../repositories/AuditEventRepository');
const AuditEvent = require('../models/AuditEvent');

const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;

class AuditService {
  constructor() {
    this.auditEventRepository = new AuditEventRepository();
  }

  /**
   * Record a single audit event.
   *
   * @param {Object} params
   * @param {number|null} [params.actorId]     users.id at time of action; null for system events.
   * @param {string|null} [params.actorEmail]  Snapshot of actor email; null for system events.
   * @param {string}      params.actionType    Stable catalogue code (see docs/audit-events.md).
   * @param {string|null} [params.targetType]  e.g. 'booking', 'user'.
   * @param {number|null} [params.targetId]
   * @param {string|null} [params.summary]     Short human-readable summary.
   * @param {Object|null} [params.payload]     Structured context — no secrets.
   * @param {string|null} [params.ipAddress]
   * @returns {Promise<AuditEvent>} The persisted event, re-read from the DB.
   */
  async logEvent({
    actorId = null,
    actorEmail = null,
    actionType,
    targetType = null,
    targetId = null,
    summary = null,
    payload = null,
    ipAddress = null,
  } = {}) {
    if (!actionType || typeof actionType !== 'string') {
      throw new Error('actionType is required and must be a non-empty string');
    }
    const event = new AuditEvent({
      actor_id: actorId,
      actor_email: actorEmail,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      summary,
      payload,
      ip_address: ipAddress,
    });
    return await this.auditEventRepository.create(event);
  }

  async getEvents({ limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = {}) {
    return await this.auditEventRepository.findAll({ limit, offset });
  }

  async searchEvents({ query = '', limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = {}) {
    return await this.auditEventRepository.search({ query, limit, offset });
  }

  async getEventById(id) {
    const event = await this.auditEventRepository.findById(id);
    if (!event) {
      throw new Error(`Audit event not found for id ${id}`);
    }
    return event;
  }
}

module.exports = AuditService;
