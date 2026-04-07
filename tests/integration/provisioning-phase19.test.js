const request = require('supertest');
const app = require('../../src/backend/server');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');

describe('Phase 19: Admin provisioning and profile completion', () => {
  let seedAdmin;
  let adminToken;

  beforeAll(async () => {
    const userService = new UserService();
    seedAdmin = await userService.getUserByUsername('admin');
    adminToken = generateToken(seedAdmin);
  });

  test('GET /api/auth/provision/validate rejects missing token', async () => {
    const res = await request(app).get('/api/auth/provision/validate').query({ token: '' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  test('full flow: provision, complete profile, login, access desks', async () => {
    const createRes = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Phase Nineteen User',
        email: `p19_${Date.now()}@test.com`,
      });

    expect(createRes.status).toBe(201);
    const { invitationToken, email } = createRes.body;
    expect(invitationToken).toBeDefined();

    const val = await request(app)
      .get('/api/auth/provision/validate')
      .query({ token: invitationToken });
    expect(val.body.valid).toBe(true);
    expect(val.body.email).toBe(email);

    const completeRes = await request(app)
      .post('/api/auth/complete-profile')
      .send({
        token: invitationToken,
        password: 'SecurePass1!',
        office_location: 'London',
      });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.user.profileComplete).toBe(true);
    expect(completeRes.body.token).toBeDefined();
    expect(typeof completeRes.body.token).toBe('string');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: email, password: 'SecurePass1!' });
    expect(loginRes.status).toBe(200);
    const userToken = loginRes.body.token;

    const desksRes = await request(app)
      .get('/api/desks')
      .set('Authorization', `Bearer ${userToken}`);
    expect(desksRes.status).toBe(200);
  });

  test('provisioned user cannot access desks before profile completion', async () => {
    const createRes = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Incomplete User',
        email: `p19_inc_${Date.now()}@test.com`,
      });
    expect(createRes.status).toBe(201);

    const fakeToken = generateToken({
      id: createRes.body.id,
      username: createRes.body.username,
      role: createRes.body.role,
    });

    const desksRes = await request(app)
      .get('/api/desks')
      .set('Authorization', `Bearer ${fakeToken}`);
    expect(desksRes.status).toBe(403);
    expect(desksRes.body.error.code).toBe('PROFILE_INCOMPLETE');
  });
});
