/**
 * Use Case 4: Admin Sets Up Number of Desks and Parking Spaces
 * 
 * This test validates the complete workflow:
 * 1. Admin views current configuration
 * 2. Admin updates desk count
 * 3. Admin updates parking count
 * 4. System validates configuration (cannot reduce below active bookings)
 * 5. System creates/updates resources based on configuration
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const AdminService = require('../../src/backend/services/AdminService');
const DeskService = require('../../src/backend/services/DeskService');
const ParkingSpaceService = require('../../src/backend/services/ParkingSpaceService');
const AdminConfigurationRepository = require('../../src/backend/repositories/AdminConfigurationRepository');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');

describe('Use Case 4: Admin Sets Up Number of Desks and Parking Spaces', () => {
  let adminService;
  let deskService;
  let parkingSpaceService;
  let configRepository;
  let deskRepository;
  let parkingSpaceRepository;
  let adminToken;

  beforeAll(async () => {
    adminService = new AdminService();
    deskService = new DeskService();
    parkingSpaceService = new ParkingSpaceService();
    configRepository = new AdminConfigurationRepository();
    deskRepository = new DeskRepository();
    parkingSpaceRepository = new ParkingSpaceRepository();

    adminToken = 'Bearer admin_4001';
  });

  afterAll(async () => {
    // Cleanup: Reset configuration if needed
    try {
      await configRepository.setDeskCount(0);
      await configRepository.setParkingCount(0);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('Step 1-4: Admin can view current configuration', async () => {
    const response = await request(app)
      .get('/api/admin/configuration')
      .set('Authorization', adminToken);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('deskCount');
    expect(response.body).toHaveProperty('parkingCount');
    expect(typeof response.body.deskCount).toBe('number');
    expect(typeof response.body.parkingCount).toBe('number');
  });

  test('Step 5-7: Admin can update desk count', async () => {
    const newDeskCount = 10;

    const response = await request(app)
      .put('/api/admin/configuration/desk-count')
      .set('Authorization', adminToken)
      .send({ deskCount: newDeskCount });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('deskCount');
    expect(response.body.deskCount).toBe(newDeskCount);
  });

  test('Step 5-7: Admin can update parking count', async () => {
    const newParkingCount = 8;

    const response = await request(app)
      .put('/api/admin/configuration/parking-count')
      .set('Authorization', adminToken)
      .send({ parkingCount: newParkingCount });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('parkingCount');
    expect(response.body.parkingCount).toBe(newParkingCount);
  });

  test('Step 8: System validates configuration - cannot reduce below active bookings', async () => {
    const userToken = 'Bearer user_4001';
    
    const desk = await deskService.createDesk({
      deskNumber: 'UC4-D001',
      location: 'Floor 1',
      description: 'Test desk for Use Case 4',
      isActive: true,
    });

    const bookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', userToken)
      .send({
        deskId: desk.id,
        startDate: '2025-12-20',
        endDate: '2025-12-20',
      });

    expect(bookingResponse.status).toBe(201);

    const currentDesks = await deskRepository.findAllActive();
    const activeDeskCount = currentDesks.length;

    const response = await request(app)
      .put('/api/admin/configuration/desk-count')
      .set('Authorization', adminToken)
      .send({ deskCount: activeDeskCount - 1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_DESK_COUNT');
    expect(response.body.error.message).toContain('cannot reduce');
  });

  test('Step 9-10: Configuration update creates/updates resources', async () => {
    const newDeskCount = 15;
    const newParkingCount = 12;

    const response = await request(app)
      .put('/api/admin/configuration/desk-count')
      .set('Authorization', adminToken)
      .send({ deskCount: newDeskCount });

    expect(response.status).toBe(200);

    const desksResponse = await request(app)
      .get('/api/desks')
      .set('Authorization', adminToken);

    expect(desksResponse.status).toBe(200);
    expect(Array.isArray(desksResponse.body)).toBe(true);
  });
});

