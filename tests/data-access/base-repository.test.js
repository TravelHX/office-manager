const BaseRepository = require('../src/backend/data-access/base-repository');
const { executeQuery } = require('../src/backend/database/connection');
const { createPool, closePool } = require('../src/backend/database/connection');

describe('BaseRepository', () => {
  let testTableName;
  let repository;

  beforeAll(async () => {
    await createPool();
    testTableName = 'test_repository_table';
    
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS ${testTableName} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        value INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    repository = new BaseRepository(testTableName);
  });

  afterAll(async () => {
    await executeQuery(`DROP TABLE IF EXISTS ${testTableName}`);
    await closePool();
  });

  beforeEach(async () => {
    await executeQuery(`DELETE FROM ${testTableName}`);
  });

  test('should create a new record', async () => {
    const data = { name: 'Test Item', value: 100 };
    const id = await repository.create(data);
    
    expect(id).toBeDefined();
    expect(typeof id).toBe('number');
  });

  test('should find a record by id', async () => {
    const data = { name: 'Test Item', value: 100 };
    const id = await repository.create(data);
    
    const result = await repository.findById(id);
    
    expect(result).toBeDefined();
    expect(result.id).toBe(id);
    expect(result.name).toBe('Test Item');
    expect(result.value).toBe(100);
  });

  test('should find all records', async () => {
    await repository.create({ name: 'Item 1', value: 10 });
    await repository.create({ name: 'Item 2', value: 20 });
    
    const results = await repository.findAll();
    
    expect(results).toBeDefined();
    expect(results.length).toBe(2);
  });

  test('should update a record', async () => {
    const data = { name: 'Test Item', value: 100 };
    const id = await repository.create(data);
    
    await repository.update(id, { name: 'Updated Item', value: 200 });
    
    const result = await repository.findById(id);
    expect(result.name).toBe('Updated Item');
    expect(result.value).toBe(200);
  });

  test('should delete a record', async () => {
    const data = { name: 'Test Item', value: 100 };
    const id = await repository.create(data);
    
    await repository.delete(id);
    
    const result = await repository.findById(id);
    expect(result).toBeNull();
  });

  test('should execute raw queries', async () => {
    await repository.create({ name: 'Test Item', value: 100 });
    
    const result = await repository.executeRawQuery(
      `SELECT COUNT(*) as count FROM ${testTableName}`
    );
    
    expect(result[0].count).toBe(1);
  });
});

