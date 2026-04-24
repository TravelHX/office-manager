// AuditEvent model for the append-only audit_events table.
// See docs/audit-events.md for the event type catalogue and the column
// contract, and src/sql/08-audit-events-schema.sql for the schema.
//
// Shape conventions match the rest of the codebase:
//   - Database rows use snake_case (e.g. action_type).
//   - Model properties are camelCase (e.g. actionType).
//   - toJSON() returns the camelCase shape for API responses.
//   - toDatabaseFormat() returns the snake_case shape for INSERT,
//     omitting null optional fields so they default to NULL at the DB.

class AuditEvent {
  constructor(data = {}) {
    this.id = data.id != null ? data.id : null;
    this.occurredAt = data.occurred_at != null ? data.occurred_at : null;
    this.actorId = data.actor_id != null ? data.actor_id : null;
    this.actorEmail = data.actor_email != null ? data.actor_email : null;
    this.actionType = data.action_type;
    this.targetType = data.target_type != null ? data.target_type : null;
    this.targetId = data.target_id != null ? data.target_id : null;
    this.summary = data.summary != null ? data.summary : null;
    this.payload = AuditEvent._parsePayload(data.payload);
    this.ipAddress = data.ip_address != null ? data.ip_address : null;
  }

  static _parsePayload(payload) {
    if (payload == null) {
      return null;
    }
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch (_err) {
        return null;
      }
    }
    // Already a plain object (e.g. when building an AuditEvent in-process).
    return payload;
  }

  toJSON() {
    return {
      id: this.id,
      occurredAt: this.occurredAt,
      actorId: this.actorId,
      actorEmail: this.actorEmail,
      actionType: this.actionType,
      targetType: this.targetType,
      targetId: this.targetId,
      summary: this.summary,
      payload: this.payload,
      ipAddress: this.ipAddress,
    };
  }

  toDatabaseFormat() {
    // action_type is the only required column besides the server-issued id
    // and occurred_at. All other columns are nullable; omit them when the
    // model value is null so MySQL inserts NULL rather than an empty string.
    const row = { action_type: this.actionType };
    if (this.actorId != null) row.actor_id = this.actorId;
    if (this.actorEmail != null) row.actor_email = this.actorEmail;
    if (this.targetType != null) row.target_type = this.targetType;
    if (this.targetId != null) row.target_id = this.targetId;
    if (this.summary != null) row.summary = this.summary;
    if (this.payload != null) row.payload = JSON.stringify(this.payload);
    if (this.ipAddress != null) row.ip_address = this.ipAddress;
    return row;
  }
}

module.exports = AuditEvent;
