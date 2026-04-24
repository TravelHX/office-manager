const AuditEvent = require('../../src/backend/models/AuditEvent');

describe('AuditEvent model', () => {
  describe('constructor', () => {
    test('maps snake_case database row fields to camelCase properties', () => {
      const event = new AuditEvent({
        id: 10,
        occurred_at: '2026-04-24 09:00:00',
        actor_id: 42,
        actor_email: 'alice@test.com',
        action_type: 'DESK_BOOKING_CREATED',
        target_type: 'booking',
        target_id: 7,
        summary: 'Booked desk D001 for 2 days',
        payload: { desk_id: 3, start_date: '2026-05-01', end_date: '2026-05-02' },
        ip_address: '10.0.0.1',
      });

      expect(event.id).toBe(10);
      expect(event.occurredAt).toBe('2026-04-24 09:00:00');
      expect(event.actorId).toBe(42);
      expect(event.actorEmail).toBe('alice@test.com');
      expect(event.actionType).toBe('DESK_BOOKING_CREATED');
      expect(event.targetType).toBe('booking');
      expect(event.targetId).toBe(7);
      expect(event.summary).toBe('Booked desk D001 for 2 days');
      expect(event.payload).toEqual({ desk_id: 3, start_date: '2026-05-01', end_date: '2026-05-02' });
      expect(event.ipAddress).toBe('10.0.0.1');
    });

    test('parses payload when stored as a JSON string (as MySQL may return)', () => {
      const event = new AuditEvent({
        action_type: 'AUTH_LOGIN_SUCCESS',
        payload: '{"attempted_email":"bob@test.com"}',
      });
      expect(event.payload).toEqual({ attempted_email: 'bob@test.com' });
    });

    test('keeps payload null when absent', () => {
      const event = new AuditEvent({ action_type: 'AUTH_LOGOUT' });
      expect(event.payload).toBeNull();
    });

    test('keeps payload null when string payload is invalid JSON', () => {
      const event = new AuditEvent({ action_type: 'AUTH_LOGOUT', payload: 'not-json' });
      expect(event.payload).toBeNull();
    });

    test('preserves null actor for system events', () => {
      const event = new AuditEvent({
        action_type: 'AUTH_LOGIN_FAILURE',
        actor_id: null,
        actor_email: null,
      });
      expect(event.actorId).toBeNull();
      expect(event.actorEmail).toBeNull();
    });
  });

  describe('toJSON', () => {
    test('returns camelCase object suitable for API response', () => {
      const event = new AuditEvent({
        id: 1,
        occurred_at: '2026-04-24 09:00:00',
        actor_id: 5,
        actor_email: 'a@b.com',
        action_type: 'USER_CREATED',
        target_type: 'user',
        target_id: 9,
        summary: 'Created user 9',
        payload: { created_user_id: 9 },
        ip_address: null,
      });
      expect(event.toJSON()).toEqual({
        id: 1,
        occurredAt: '2026-04-24 09:00:00',
        actorId: 5,
        actorEmail: 'a@b.com',
        actionType: 'USER_CREATED',
        targetType: 'user',
        targetId: 9,
        summary: 'Created user 9',
        payload: { created_user_id: 9 },
        ipAddress: null,
      });
    });
  });

  describe('toDatabaseFormat', () => {
    test('returns snake_case object with payload JSON-stringified', () => {
      const event = new AuditEvent({
        actor_id: 5,
        actor_email: 'a@b.com',
        action_type: 'DESK_BOOKING_CREATED',
        target_type: 'booking',
        target_id: 7,
        summary: 'Booked desk',
        payload: { desk_id: 3 },
        ip_address: '10.0.0.1',
      });
      const row = event.toDatabaseFormat();
      expect(row.actor_id).toBe(5);
      expect(row.actor_email).toBe('a@b.com');
      expect(row.action_type).toBe('DESK_BOOKING_CREATED');
      expect(row.target_type).toBe('booking');
      expect(row.target_id).toBe(7);
      expect(row.summary).toBe('Booked desk');
      expect(row.payload).toBe('{"desk_id":3}');
      expect(row.ip_address).toBe('10.0.0.1');
    });

    test('omits null optional fields so they default to NULL at the database level', () => {
      const event = new AuditEvent({ action_type: 'AUTH_LOGOUT' });
      const row = event.toDatabaseFormat();
      expect(row).toEqual({ action_type: 'AUTH_LOGOUT' });
    });

    test('requires action_type on output (never omitted)', () => {
      const event = new AuditEvent({
        action_type: 'USER_DELETED',
        payload: null,
        actor_id: null,
      });
      const row = event.toDatabaseFormat();
      expect(row.action_type).toBe('USER_DELETED');
      expect(row).not.toHaveProperty('payload');
      expect(row).not.toHaveProperty('actor_id');
    });
  });
});
