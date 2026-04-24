// AuditEventRepository — append-only data access for audit_events.
//
// Spec section 15 requires audit records to be append-only from the
// application. This repository enforces that by overriding BaseRepository's
// `update` and `delete` to throw; there is no code path through the
// application that can mutate or remove an audit row.
//
// Search is a single-field substring match over the columns an admin is
// most likely to filter on: action_type, actor_email, summary, and the
// stringified payload (MySQL's CAST(JSON AS CHAR) is used here so the
// LIKE applies to the serialised JSON text).

const BaseRepository = require('../data-access/base-repository');
const AuditEvent = require('../models/AuditEvent');

const DEFAULT_LIMIT = 50;
const DEFAULT_OFFSET = 0;

/**
 * Coerce limit/offset to non-negative integers for safe SQL interpolation.
 * Falls back to the defaults if anything non-numeric slips through upstream
 * validation.
 */
function sanitisePagination(limit, offset) {
  const parsedLimit = Number.parseInt(limit, 10);
  const parsedOffset = Number.parseInt(offset, 10);
  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit >= 0 ? parsedLimit : DEFAULT_LIMIT,
    offset: Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : DEFAULT_OFFSET,
  };
}

class AuditEventRepository extends BaseRepository {
  constructor() {
    super('audit_events');
  }

  async create(auditEvent) {
    const row = auditEvent.toDatabaseFormat();
    const insertId = await super.create(row);
    return await this.findById(insertId);
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new AuditEvent(result) : null;
  }

  async findAll({ limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = {}) {
    // LIMIT / OFFSET are interpolated into the SQL after sanitising to
    // non-negative integers. Binding them as prepared parameters fails
    // against mysql2's `connection.execute()` path with
    // "Incorrect arguments to mysqld_stmt_execute" — mysql2 sends them as
    // strings and the MySQL server rejects LIMIT as a non-integer literal.
    // Sanitisation is done here (defence in depth) and upstream at the route
    // layer; we never accept untrusted text.
    const { limit: safeLimit, offset: safeOffset } = sanitisePagination(limit, offset);
    const sql = `
      SELECT * FROM audit_events
      ORDER BY occurred_at DESC, id DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const results = await this.executeRawQuery(sql, []);
    return results.map((row) => new AuditEvent(row));
  }

  async search({ query = '', limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = {}) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return this.findAll({ limit, offset });
    }
    const like = `%${trimmed}%`;
    const { limit: safeLimit, offset: safeOffset } = sanitisePagination(limit, offset);
    // LIKE patterns remain parameterised; only the validated pagination
    // integers are interpolated. See comment on findAll above.
    const sql = `
      SELECT * FROM audit_events
      WHERE action_type LIKE ?
         OR actor_email LIKE ?
         OR summary LIKE ?
         OR CAST(payload AS CHAR) LIKE ?
      ORDER BY occurred_at DESC, id DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const params = [like, like, like, like];
    const results = await this.executeRawQuery(sql, params);
    return results.map((row) => new AuditEvent(row));
  }

  // Append-only invariant: block the mutating BaseRepository methods with
  // explicit errors. There is no code path through the application that can
  // mutate or remove an audit row.
  async update() {
    throw new Error('Audit events are append-only; update is not permitted');
  }

  async delete() {
    throw new Error('Audit events are append-only; delete is not permitted');
  }
}

module.exports = AuditEventRepository;
