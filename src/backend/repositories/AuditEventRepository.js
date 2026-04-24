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
    const sql = `
      SELECT * FROM audit_events
      ORDER BY occurred_at DESC, id DESC
      LIMIT ? OFFSET ?
    `;
    const results = await this.executeRawQuery(sql, [limit, offset]);
    return results.map((row) => new AuditEvent(row));
  }

  async search({ query = '', limit = DEFAULT_LIMIT, offset = DEFAULT_OFFSET } = {}) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return this.findAll({ limit, offset });
    }
    const like = `%${trimmed}%`;
    const sql = `
      SELECT * FROM audit_events
      WHERE action_type LIKE ?
         OR actor_email LIKE ?
         OR summary LIKE ?
         OR CAST(payload AS CHAR) LIKE ?
      ORDER BY occurred_at DESC, id DESC
      LIMIT ? OFFSET ?
    `;
    const params = [like, like, like, like, limit, offset];
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
