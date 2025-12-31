const { createPool, closePool } = require('../src/backend/database/connection');

beforeAll(async () => {
  await createPool();
});

afterAll(async () => {
  await closePool();
});

