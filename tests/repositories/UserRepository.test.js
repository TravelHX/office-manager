const UserRepository = require('../../src/backend/repositories/UserRepository');
const User = require('../../src/backend/models/User');
const { executeQuery } = require('../../src/backend/database/connection');

describe('UserRepository', () => {
  let repository;

  beforeAll(async () => {
    repository = new UserRepository();
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM bookings');
    await executeQuery('DELETE FROM parking_reservations');
    await executeQuery('DELETE FROM users');
  });

  describe('findById', () => {
    test('should return User instance when found', async () => {
      await executeQuery(`
        INSERT INTO users (id, username, password_hash, is_admin) 
        VALUES ('0001', 'testuser', 'hash123', 0)
      `);

      const user = await repository.findById('0001');

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe('0001');
      expect(user.username).toBe('testuser');
    });

    test('should return null when not found', async () => {
      const user = await repository.findById('9999');
      expect(user).toBeNull();
    });
  });

  describe('findByUsername', () => {
    test('should return User instance when found', async () => {
      await executeQuery(`
        INSERT INTO users (id, username, password_hash, is_admin) 
        VALUES ('0001', 'testuser', 'hash123', 0)
      `);

      const user = await repository.findByUsername('testuser');

      expect(user).toBeInstanceOf(User);
      expect(user.username).toBe('testuser');
    });
  });

  describe('findByEmail', () => {
    test('should return User instance when found', async () => {
      await executeQuery(`
        INSERT INTO users (id, username, email, password_hash, is_admin) 
        VALUES ('0001', 'testuser', 'test@example.com', 'hash123', 0)
      `);

      const user = await repository.findByEmail('test@example.com');

      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('create', () => {
    test('should create user from User instance', async () => {
      const user = new User({
        username: 'newuser',
        passwordHash: 'hash456',
        isAdmin: false,
      });

      const created = await repository.create(user);

      expect(created).toBeInstanceOf(User);
      expect(created.id).toBeDefined();
      expect(created.username).toBe('newuser');
    });
  });

  describe('createWithId', () => {
    test('should create user with specific ID', async () => {
      const user = new User({
        id: '0005',
        username: 'specificuser',
        passwordHash: 'hash789',
        isAdmin: false,
      });

      const created = await repository.createWithId(user);

      expect(created.id).toBe('0005');
      expect(created.username).toBe('specificuser');
    });

    test('should throw error if ID already exists', async () => {
      await executeQuery(`
        INSERT INTO users (id, username, password_hash, is_admin) 
        VALUES ('0006', 'existing', 'hash', 0)
      `);

      const user = new User({
        id: '0006',
        username: 'newuser',
        passwordHash: 'hash',
        isAdmin: false,
      });

      await expect(repository.createWithId(user)).rejects.toThrow();
    });

    test('should throw error if username already exists', async () => {
      await executeQuery(`
        INSERT INTO users (id, username, password_hash, is_admin) 
        VALUES ('0007', 'existinguser', 'hash', 0)
      `);

      const user = new User({
        id: '0008',
        username: 'existinguser',
        passwordHash: 'hash',
        isAdmin: false,
      });

      await expect(repository.createWithId(user)).rejects.toThrow();
    });
  });

  describe('updatePassword', () => {
    test('should update user password hash', async () => {
      await executeQuery(`
        INSERT INTO users (id, username, password_hash, is_admin) 
        VALUES ('0001', 'testuser', 'oldhash', 0)
      `);

      const updated = await repository.updatePassword('0001', 'newhash');

      expect(updated.passwordHash).toBe('newhash');
    });
  });
});
