const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const Desk = require('../../src/backend/models/Desk');
const { executeQuery } = require('../../src/backend/database/connection');

describe('DeskRepository', () => {
  let repository;

  beforeAll(async () => {
    repository = new DeskRepository();
  });

  beforeEach(async () => {
    // Clean up desks table
    await executeQuery('DELETE FROM bookings');
    await executeQuery('DELETE FROM desks');
  });

  describe('findAllActive', () => {
    test('should return only active desks ordered by desk_number', async () => {
      await executeQuery(`
        INSERT INTO desks (desk_number, location, is_active) VALUES
        ('2', 'Floor 1', 1),
        ('1', 'Floor 1', 1),
        ('3', 'Floor 2', 0)
      `);

      const results = await repository.findAllActive();

      expect(results).toHaveLength(2);
      expect(results[0].deskNumber).toBe('1');
      expect(results[1].deskNumber).toBe('2');
      expect(results.every(d => d.isActive)).toBe(true);
    });

    test('should return empty array when no active desks exist', async () => {
      await executeQuery(`
        INSERT INTO desks (desk_number, location, is_active) VALUES
        ('1', 'Floor 1', 0)
      `);

      const results = await repository.findAllActive();

      expect(results).toHaveLength(0);
    });
  });

  describe('findById', () => {
    test('should return Desk instance when found', async () => {
      const result = await executeQuery(`
        INSERT INTO desks (desk_number, location, is_active) 
        VALUES ('1', 'Floor 1', 1)
      `);
      const id = result.insertId;

      const desk = await repository.findById(id);

      expect(desk).toBeInstanceOf(Desk);
      expect(desk.id).toBe(id);
      expect(desk.deskNumber).toBe('1');
    });

    test('should return null when not found', async () => {
      const desk = await repository.findById(99999);
      expect(desk).toBeNull();
    });
  });

  describe('findByDeskNumber', () => {
    test('should return Desk instance when found', async () => {
      await executeQuery(`
        INSERT INTO desks (desk_number, location, is_active) 
        VALUES ('5', 'Floor 2', 1)
      `);

      const desk = await repository.findByDeskNumber('5');

      expect(desk).toBeInstanceOf(Desk);
      expect(desk.deskNumber).toBe('5');
    });

    test('should return null when not found', async () => {
      const desk = await repository.findByDeskNumber('999');
      expect(desk).toBeNull();
    });
  });

  describe('create', () => {
    test('should create desk from Desk instance', async () => {
      const desk = new Desk({
        deskNumber: '10',
        location: 'Floor 3',
        isActive: true,
      });

      const created = await repository.create(desk);

      expect(created).toBeInstanceOf(Desk);
      expect(created.id).toBeDefined();
      expect(created.deskNumber).toBe('10');
    });

    test('should create desk from plain object', async () => {
      const deskData = {
        deskNumber: '11',
        location: 'Floor 3',
        isActive: true,
      };

      const created = await repository.create(deskData);

      expect(created).toBeInstanceOf(Desk);
      expect(created.deskNumber).toBe('11');
    });
  });

  describe('update', () => {
    test('should update desk from Desk instance', async () => {
      const result = await executeQuery(`
        INSERT INTO desks (desk_number, location, is_active) 
        VALUES ('1', 'Floor 1', 1)
      `);
      const id = result.insertId;

      const updatedDesk = new Desk({
        id,
        deskNumber: '1',
        location: 'Floor 2',
        isActive: true,
      });

      const updated = await repository.update(id, updatedDesk);

      expect(updated.location).toBe('Floor 2');
    });

    test('should update desk from plain object', async () => {
      const result = await executeQuery(`
        INSERT INTO desks (desk_number, location, is_active) 
        VALUES ('2', 'Floor 1', 1)
      `);
      const id = result.insertId;

      const updated = await repository.update(id, { location: 'Floor 3' });

      expect(updated.location).toBe('Floor 3');
    });
  });

  describe('findAll', () => {
    test('should return all desks as Desk instances', async () => {
      await executeQuery(`
        INSERT INTO desks (desk_number, location, is_active) VALUES
        ('1', 'Floor 1', 1),
        ('2', 'Floor 1', 0)
      `);

      const results = await repository.findAll();

      expect(results).toHaveLength(2);
      expect(results.every(d => d instanceof Desk)).toBe(true);
    });
  });
});
