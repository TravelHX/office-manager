// Unit tests for AuditEventRepository. The repository extends BaseRepository
// and delegates to executeQuery via `src/backend/database/connection`; we mock
// that module so these tests run without a live database.

jest.mock('../../src/backend/database/connection', () => ({
  executeQuery: jest.fn(),
  executeTransaction: jest.fn(),
}));

const { executeQuery } = require('../../src/backend/database/connection');
const AuditEventRepository = require('../../src/backend/repositories/AuditEventRepository');
const AuditEvent = require('../../src/backend/models/AuditEvent');

describe('AuditEventRepository', () => {
  let repository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new AuditEventRepository();
  });

  describe('append-only invariant', () => {
    test('update throws because audit events are append-only', async () => {
      await expect(repository.update(1, { summary: 'x' })).rejects.toThrow(
        /append-only/i
      );
      expect(executeQuery).not.toHaveBeenCalled();
    });

    test('delete throws because audit events are append-only', async () => {
      await expect(repository.delete(1)).rejects.toThrow(/append-only/i);
      expect(executeQuery).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    test('persists the event using the INSERT returned by BaseRepository and re-reads it', async () => {
      // First call: the INSERT from BaseRepository.create.
      executeQuery.mockResolvedValueOnce({ insertId: 101 });
      // Second call: the SELECT inside findById that re-reads the row.
      executeQuery.mockResolvedValueOnce([
        {
          id: 101,
          occurred_at: '2026-04-24 09:00:00',
          actor_id: 5,
          actor_email: 'a@b.com',
          action_type: 'DESK_BOOKING_CREATED',
          target_type: 'booking',
          target_id: 7,
          summary: 'Booked desk',
          payload: '{"desk_id":3}',
          ip_address: '10.0.0.1',
        },
      ]);

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

      const result = await repository.create(event);

      // The first call is the INSERT; verify it hits the right table and does
      // not contain a forbidden `id` column (auto-increment).
      const insertCall = executeQuery.mock.calls[0];
      expect(insertCall[0]).toMatch(/^INSERT INTO audit_events/);
      expect(insertCall[0]).not.toMatch(/\bid\b/);

      // The second call is the SELECT that re-reads the inserted row.
      expect(executeQuery.mock.calls[1][0]).toMatch(/^SELECT \* FROM audit_events WHERE id = \?/);
      expect(executeQuery.mock.calls[1][1]).toEqual([101]);

      expect(result).toBeInstanceOf(AuditEvent);
      expect(result.id).toBe(101);
      expect(result.actionType).toBe('DESK_BOOKING_CREATED');
      expect(result.payload).toEqual({ desk_id: 3 });
    });
  });

  describe('findById', () => {
    test('returns an AuditEvent instance when the row exists', async () => {
      executeQuery.mockResolvedValueOnce([
        {
          id: 5,
          occurred_at: '2026-04-24 09:00:00',
          actor_id: null,
          actor_email: null,
          action_type: 'AUTH_LOGIN_FAILURE',
          target_type: null,
          target_id: null,
          summary: null,
          payload: '{"attempted_email":"x@y.com"}',
          ip_address: '10.0.0.2',
        },
      ]);

      const event = await repository.findById(5);
      expect(event).toBeInstanceOf(AuditEvent);
      expect(event.id).toBe(5);
      expect(event.actionType).toBe('AUTH_LOGIN_FAILURE');
      expect(event.payload).toEqual({ attempted_email: 'x@y.com' });
    });

    test('returns null when the row does not exist', async () => {
      executeQuery.mockResolvedValueOnce([]);
      const event = await repository.findById(999);
      expect(event).toBeNull();
    });
  });

  describe('findAll (paginated)', () => {
    // LIMIT / OFFSET are interpolated into the SQL string after sanitising to
    // non-negative integers; binding them as prepared parameters trips
    // mysql2's connection.execute() path with
    // "Incorrect arguments to mysqld_stmt_execute". See the repository
    // sanitisePagination() helper.
    test('selects with default pagination ordered newest first', async () => {
      executeQuery.mockResolvedValueOnce([]);
      await repository.findAll();
      const [sql, params] = executeQuery.mock.calls[0];
      expect(sql).toMatch(/ORDER BY occurred_at DESC/);
      expect(sql).toMatch(/LIMIT 50 OFFSET 0/);
      expect(params).toEqual([]);
    });

    test('respects explicit limit and offset', async () => {
      executeQuery.mockResolvedValueOnce([]);
      await repository.findAll({ limit: 10, offset: 20 });
      const [sql, params] = executeQuery.mock.calls[0];
      expect(sql).toMatch(/LIMIT 10 OFFSET 20/);
      expect(params).toEqual([]);
    });

    test('falls back to defaults when limit/offset are not valid non-negative integers', async () => {
      executeQuery.mockResolvedValueOnce([]);
      // sanitisePagination rejects NaN / negative values and restores defaults.
      await repository.findAll({ limit: -5, offset: 'abc' });
      const [sql] = executeQuery.mock.calls[0];
      expect(sql).toMatch(/LIMIT 50 OFFSET 0/);
    });

    test('maps each row to an AuditEvent', async () => {
      executeQuery.mockResolvedValueOnce([
        { id: 1, action_type: 'AUTH_LOGOUT' },
        { id: 2, action_type: 'USER_CREATED' },
      ]);
      const results = await repository.findAll();
      expect(results).toHaveLength(2);
      results.forEach((r) => expect(r).toBeInstanceOf(AuditEvent));
      expect(results.map((r) => r.actionType)).toEqual(['AUTH_LOGOUT', 'USER_CREATED']);
    });
  });

  describe('search', () => {
    test('with empty query delegates to findAll ordering and pagination', async () => {
      executeQuery.mockResolvedValueOnce([]);
      await repository.search({ query: '   ', limit: 5, offset: 0 });
      const [sql] = executeQuery.mock.calls[0];
      // Empty query must not add LIKE predicates.
      expect(sql).not.toMatch(/LIKE/);
      expect(sql).toMatch(/ORDER BY occurred_at DESC/);
    });

    test('with non-empty query builds LIKE predicates for action_type, actor_email, summary, and payload', async () => {
      executeQuery.mockResolvedValueOnce([]);
      await repository.search({ query: 'alice', limit: 25, offset: 0 });
      const [sql, params] = executeQuery.mock.calls[0];
      // One LIKE per searchable column.
      const likeCount = (sql.match(/LIKE \?/g) || []).length;
      expect(likeCount).toBe(4);
      // LIKE patterns remain parameterised; LIMIT / OFFSET are interpolated
      // as sanitised integers (see findAll notes above).
      expect(params).toEqual(['%alice%', '%alice%', '%alice%', '%alice%']);
      expect(sql).toMatch(/LIMIT 25 OFFSET 0/);
    });

    test('trims whitespace around the search query', async () => {
      executeQuery.mockResolvedValueOnce([]);
      await repository.search({ query: '  login  ' });
      const params = executeQuery.mock.calls[0][1];
      expect(params[0]).toBe('%login%');
    });
  });
});
