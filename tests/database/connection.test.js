const { createPool, getPool, executeQuery, closePool } = require('../src/backend/database/connection');
const config = require('../src/backend/config/config');

describe('Database Connection', () => {
  beforeAll(async () => {
    await createPool();
  });

  afterAll(async () => {
    await closePool();
  });

  test('should create a connection pool', () => {
    const pool = getPool();
    expect(pool).toBeDefined();
  });

  test('should execute a simple query', async () => {
    const result = await executeQuery('SELECT 1 as test');
    expect(result).toBeDefined();
    expect(result[0].test).toBe(1);
  });

  test('should execute a query with parameters', async () => {
    const result = await executeQuery('SELECT ? as value', [42]);
    expect(result).toBeDefined();
    expect(result[0].value).toBe(42);
  });

  test('should handle database errors gracefully', async () => {
    await expect(
      executeQuery('SELECT * FROM non_existent_table')
    ).rejects.toThrow();
  });
});

