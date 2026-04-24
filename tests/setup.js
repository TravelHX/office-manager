const { createPool, closePool } = require('../src/backend/database/connection');
const { runMigrations } = require('../src/backend/database/migrations');

beforeAll(async () => {
  await createPool();
  await runMigrations();
  // If the current test file pulled in the Express app (integration tests via supertest),
  // wait for its full startup chain (migrations, startup cleanup, version init) to
  // finish before any test runs. Unit tests that don't import server.js skip this.
  const serverPath = require.resolve('../src/backend/server');
  if (require.cache[serverPath] && require.cache[serverPath].exports && require.cache[serverPath].exports.startupPromise) {
    await require.cache[serverPath].exports.startupPromise;
  }
});

afterAll(async () => {
  await closePool();
});

