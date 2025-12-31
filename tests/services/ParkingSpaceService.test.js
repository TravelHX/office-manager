const ParkingSpaceService = require('../../src/backend/services/ParkingSpaceService');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');
const ParkingSpace = require('../../src/backend/models/ParkingSpace');

jest.mock('../../src/backend/repositories/ParkingSpaceRepository');
jest.mock('../../src/backend/repositories/ParkingReservationRepository');

describe('ParkingSpaceService', () => {
  let parkingSpaceService;
  let mockParkingSpaceRepository;
  let mockReservationRepository;

  beforeEach(() => {
    mockParkingSpaceRepository = new ParkingSpaceRepository();
    mockReservationRepository = new ParkingReservationRepository();
    parkingSpaceService = new ParkingSpaceService();
    parkingSpaceService.parkingSpaceRepository = mockParkingSpaceRepository;
    parkingSpaceService.reservationRepository = mockReservationRepository;
  });

  describe('getAllParkingSpaces', () => {
    test('should return all active parking spaces', async () => {
      const mockSpaces = [
        new ParkingSpace({ id: 1, space_number: 'P001', location: 'Lot A', is_active: 1 }),
        new ParkingSpace({ id: 2, space_number: 'P002', location: 'Lot A', is_active: 1 }),
      ];

      mockParkingSpaceRepository.findAllActive = jest.fn().mockResolvedValue(mockSpaces);

      const result = await parkingSpaceService.getAllParkingSpaces();

      expect(result).toEqual(mockSpaces);
      expect(mockParkingSpaceRepository.findAllActive).toHaveBeenCalled();
    });
  });

  describe('getParkingSpaceById', () => {
    test('should return parking space when found', async () => {
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', location: 'Lot A', is_active: 1 });
      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);

      const result = await parkingSpaceService.getParkingSpaceById(1);

      expect(result).toEqual(mockSpace);
      expect(mockParkingSpaceRepository.findById).toHaveBeenCalledWith(1);
    });

    test('should throw error when parking space not found', async () => {
      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(parkingSpaceService.getParkingSpaceById(999)).rejects.toThrow('Parking space not found');
    });
  });

  describe('createParkingSpace', () => {
    test('should create parking space successfully', async () => {
      const spaceData = { spaceNumber: 'P001', location: 'Lot A', description: 'Test space' };
      const mockSpace = new ParkingSpace({ id: 1, ...spaceData, is_active: 1 });

      mockParkingSpaceRepository.findBySpaceNumber = jest.fn().mockResolvedValue(null);
      mockParkingSpaceRepository.create = jest.fn().mockResolvedValue(mockSpace);
      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);

      const result = await parkingSpaceService.createParkingSpace(spaceData);

      expect(result).toEqual(mockSpace);
      expect(mockParkingSpaceRepository.findBySpaceNumber).toHaveBeenCalledWith('P001');
      expect(mockParkingSpaceRepository.create).toHaveBeenCalled();
    });

    test('should throw error when space number already exists', async () => {
      const spaceData = { spaceNumber: 'P001', location: 'Lot A' };
      const existingSpace = new ParkingSpace({ id: 1, space_number: 'P001' });

      mockParkingSpaceRepository.findBySpaceNumber = jest.fn().mockResolvedValue(existingSpace);

      await expect(parkingSpaceService.createParkingSpace(spaceData)).rejects.toThrow('already exists');
    });
  });

  describe('updateParkingSpace', () => {
    test('should update parking space successfully', async () => {
      const existingSpace = new ParkingSpace({ id: 1, space_number: 'P001', location: 'Lot A', is_active: 1 });
      const updatedSpace = new ParkingSpace({ id: 1, space_number: 'P001', location: 'Lot B', is_active: 1 });

      mockParkingSpaceRepository.findById = jest.fn()
        .mockResolvedValueOnce(existingSpace)
        .mockResolvedValueOnce(updatedSpace);
      mockParkingSpaceRepository.update = jest.fn().mockResolvedValue(updatedSpace);

      const result = await parkingSpaceService.updateParkingSpace(1, { location: 'Lot B' });

      expect(result).toEqual(updatedSpace);
      expect(mockParkingSpaceRepository.update).toHaveBeenCalled();
    });

    test('should throw error when parking space not found', async () => {
      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(parkingSpaceService.updateParkingSpace(999, {})).rejects.toThrow('Parking space not found');
    });
  });

  describe('deleteParkingSpace', () => {
    test('should delete parking space successfully', async () => {
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findActiveByParkingSpaceId = jest.fn().mockResolvedValue([]);
      mockParkingSpaceRepository.delete = jest.fn().mockResolvedValue(true);

      const result = await parkingSpaceService.deleteParkingSpace(1);

      expect(result).toBe(true);
      expect(mockParkingSpaceRepository.delete).toHaveBeenCalledWith(1);
    });

    test('should throw error when parking space has active reservations', async () => {
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      const mockReservations = [{ id: 1 }];

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findActiveByParkingSpaceId = jest.fn().mockResolvedValue(mockReservations);

      await expect(parkingSpaceService.deleteParkingSpace(1)).rejects.toThrow('active reservations');
    });
  });

  describe('getAvailableParkingSpaces', () => {
    test('should return available parking spaces', async () => {
      const mockSpaces = [
        new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 }),
        new ParkingSpace({ id: 2, space_number: 'P002', is_active: 1 }),
      ];

      mockParkingSpaceRepository.findAllActive = jest.fn().mockResolvedValue(mockSpaces);
      mockReservationRepository.findConflictingReservations = jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }]);

      const result = await parkingSpaceService.getAvailableParkingSpaces('2024-01-01', 'morning');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockSpaces[0]);
    });
  });

  describe('checkParkingSpaceAvailability', () => {
    test('should return available when no conflicts', async () => {
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findConflictingReservations = jest.fn().mockResolvedValue([]);

      const result = await parkingSpaceService.checkParkingSpaceAvailability(1, '2024-01-01', 'morning');

      expect(result.available).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    test('should return unavailable when conflicts exist', async () => {
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      const mockConflict = { id: 1, toJSON: () => ({ id: 1 }) };

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findConflictingReservations = jest.fn().mockResolvedValue([mockConflict]);

      const result = await parkingSpaceService.checkParkingSpaceAvailability(1, '2024-01-01', 'morning');

      expect(result.available).toBe(false);
      expect(result.conflicts).toHaveLength(1);
    });

    test('should return unavailable when parking space is inactive', async () => {
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 0 });

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);

      const result = await parkingSpaceService.checkParkingSpaceAvailability(1, '2024-01-01', 'morning');

      expect(result.available).toBe(false);
      expect(result.reason).toBe('Parking space is not active');
    });
  });
});

