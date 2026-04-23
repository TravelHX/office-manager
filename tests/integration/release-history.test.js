const request = require('supertest');
const app = require('../../src/backend/server');

describe('Release history API Integration Tests', () => {
  describe('GET /api/release-history', () => {
    test('should return JSON with content string (public endpoint)', async () => {
      const response = await request(app).get('/api/release-history').expect(200);

      expect(response.body).toHaveProperty('content');
      expect(typeof response.body.content).toBe('string');
    });
  });
});
