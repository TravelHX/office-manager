const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const ParkingSpace = require('../../src/backend/models/ParkingSpace');
const { executeQuery } = require('../../src/backend/database/connection');

describe('ParkingSpaceRepository', () => {
  let repository;

  beforeAll(async () => {
    repository = new ParkingSpaceRepository();
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM parking_reservations');
    await executeQuery('DELETE FROM parking_spaces');
  });

  describe('findAllActive', () => {
    test('should return only active parking spaces ordered by space_number', async () => {
      await executeQuery(`
        INSERT INTO parking_spaces (space_number, location, is_active) VALUES
        ('2', 'Lot A', 1),
        ('1', 'Lot A', 1),
        ('3', 'Lot B', 0)
      `);

      const results = await repository.findAllActive();

      expect(results).toHaveLength(2);
      expect(results[0].spaceNumber).toBe('1');
      expect(results[1].spaceNumber).toBe('2');
      expect(results.every(ps => ps.isActive)).toBe(true);
    });
  });

  describe('findById', () => {
    test('should return ParkingSpace instance when found', async () => {
      const result = await executeQuery(`
        INSERT INTO parking_spaces (space_number, location, is_active) 
        VALUES ('1', 'Lot A', 1)
      `);
      const id = result.insertId;

      const space = await repository.findById(id);

      expect(space).toBeInstanceOf(ParkingSpace);
      expect(space.id).toBe(id);
    });
  });

  describe('findBySpaceNumber', () => {
    test('should return ParkingSpace instance when found', async () => {
      await executeQuery(`
        INSERT INTO parking_spaces (space_number, location, is_active) 
        VALUES ('5', 'Lot B', 1)
      `);

      const space = await repository.findBySpaceNumber('5');

      expect(space).toBeInstanceOf(ParkingSpace);
      expect(space.spaceNumber).toBe('5');
    });
  });

  describe('create', () => {
    test('should create parking space from ParkingSpace instance', async () => {
      const space = new ParkingSpace({
        spaceNumber: '10',
        location: 'Lot C',
        isActive: true,
      });

      const created = await repository.create(space);

      expect(created).toBeInstanceOf(ParkingSpace);
      expect(created.spaceNumber).toBe('10');
    });
  });

  describe('update', () => {
    test('should update parking space', async () => {
      const result = await executeQuery(`
        INSERT INTO parking_spaces (space_number, location, is_active) 
        VALUES ('1', 'Lot A', 1)
      `);
      const id = result.insertId;

      const updated = await repository.update(id, { location: 'Lot D' });

      expect(updated.location).toBe('Lot D');
    });
  });
});
