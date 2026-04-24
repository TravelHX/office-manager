// Unit tests for AuditService — pure unit tests with a mocked repository.
// No database required. We also mock the low-level database/connection module
// so the require chain (AuditService → AuditEventRepository → base-repository
// → connection → mysql2) does not need a real MySQL driver installed locally.

jest.mock('../../src/backend/database/connection', () => ({
  executeQuery: jest.fn(),
  executeTransaction: jest.fn(),
}));
jest.mock('../../src/backend/repositories/AuditEventRepository');

const AuditService = require('../../src/backend/services/AuditService');
const AuditEventRepository = require('../../src/backend/repositories/AuditEventRepository');
const AuditEvent = require('../../src/backend/models/AuditEvent');

describe('AuditService', () => {
  let auditService;
  let mockRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository = new AuditEventRepository();
    auditService = new AuditService();
    auditService.auditEventRepository = mockRepository;
  });

  describe('logEvent', () => {
    test('requires actionType', async () => {
      await expect(auditService.logEvent({})).rejects.toThrow(/actionType/i);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    test('rejects empty-string actionType', async () => {
      await expect(auditService.logEvent({ actionType: '' })).rejects.toThrow(/actionType/i);
    });

    test('persists a well-formed event through the repository and returns the stored row', async () => {
      const stored = new AuditEvent({
        id: 99,
        occurred_at: '2026-04-24 09:00:00',
        actor_id: 5,
        actor_email: 'a@b.com',
        action_type: 'DESK_BOOKING_CREATED',
        target_type: 'booking',
        target_id: 7,
        summary: 'Booked desk D001',
        payload: { desk_id: 3, start_date: '2026-05-01', end_date: '2026-05-02' },
        ip_address: '10.0.0.1',
      });
      mockRepository.create = jest.fn().mockResolvedValue(stored);

      const result = await auditService.logEvent({
        actorId: 5,
        actorEmail: 'a@b.com',
        actionType: 'DESK_BOOKING_CREATED',
        targetType: 'booking',
        targetId: 7,
        summary: 'Booked desk D001',
        payload: { desk_id: 3, start_date: '2026-05-01', end_date: '2026-05-02' },
        ipAddress: '10.0.0.1',
      });

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      const passed = mockRepository.create.mock.calls[0][0];
      expect(passed).toBeInstanceOf(AuditEvent);
      expect(passed.actorId).toBe(5);
      expect(passed.actorEmail).toBe('a@b.com');
      expect(passed.actionType).toBe('DESK_BOOKING_CREATED');
      expect(passed.targetType).toBe('booking');
      expect(passed.targetId).toBe(7);
      expect(passed.payload).toEqual({
        desk_id: 3,
        start_date: '2026-05-01',
        end_date: '2026-05-02',
      });
      expect(passed.ipAddress).toBe('10.0.0.1');

      expect(result).toBe(stored);
    });

    test('accepts a system event with no actor (actorId null, actorEmail null)', async () => {
      mockRepository.create = jest.fn().mockImplementation(async (e) => e);

      await auditService.logEvent({
        actionType: 'AUTH_LOGIN_FAILURE',
        payload: { attempted_email: 'x@y.com' },
        ipAddress: '10.0.0.2',
      });

      const passed = mockRepository.create.mock.calls[0][0];
      expect(passed.actorId).toBeNull();
      expect(passed.actorEmail).toBeNull();
      expect(passed.actionType).toBe('AUTH_LOGIN_FAILURE');
      expect(passed.payload).toEqual({ attempted_email: 'x@y.com' });
    });

    test('propagates repository errors to the caller', async () => {
      mockRepository.create = jest.fn().mockRejectedValue(new Error('DB unavailable'));
      await expect(
        auditService.logEvent({ actionType: 'AUTH_LOGOUT' })
      ).rejects.toThrow('DB unavailable');
    });
  });

  describe('getEvents', () => {
    test('delegates to repository with default pagination', async () => {
      mockRepository.findAll = jest.fn().mockResolvedValue([]);
      await auditService.getEvents();
      expect(mockRepository.findAll).toHaveBeenCalledWith({ limit: 50, offset: 0 });
    });

    test('passes through explicit pagination', async () => {
      mockRepository.findAll = jest.fn().mockResolvedValue([]);
      await auditService.getEvents({ limit: 10, offset: 40 });
      expect(mockRepository.findAll).toHaveBeenCalledWith({ limit: 10, offset: 40 });
    });
  });

  describe('searchEvents', () => {
    test('passes query and pagination to repository.search', async () => {
      mockRepository.search = jest.fn().mockResolvedValue([]);
      await auditService.searchEvents({ query: 'login', limit: 25, offset: 0 });
      expect(mockRepository.search).toHaveBeenCalledWith({
        query: 'login',
        limit: 25,
        offset: 0,
      });
    });

    test('defaults to empty query and default pagination', async () => {
      mockRepository.search = jest.fn().mockResolvedValue([]);
      await auditService.searchEvents();
      expect(mockRepository.search).toHaveBeenCalledWith({
        query: '',
        limit: 50,
        offset: 0,
      });
    });
  });

  describe('getEventById', () => {
    test('returns the event when found', async () => {
      const event = new AuditEvent({ id: 5, action_type: 'AUTH_LOGOUT' });
      mockRepository.findById = jest.fn().mockResolvedValue(event);
      const result = await auditService.getEventById(5);
      expect(result).toBe(event);
      expect(mockRepository.findById).toHaveBeenCalledWith(5);
    });

    test('throws a descriptive error when the event does not exist', async () => {
      mockRepository.findById = jest.fn().mockResolvedValue(null);
      await expect(auditService.getEventById(999)).rejects.toThrow(/not found/i);
    });
  });
});
