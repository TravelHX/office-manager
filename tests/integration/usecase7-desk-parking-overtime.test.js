/**
 * Use Case 7: Employee Books Desk, Parking Space, and Records Overtime
 * 
 * This test validates the complete workflow:
 * 1. Employee books a desk for a specific date
 * 2. Employee reserves a parking space for the same date
 * 3. Employee records overtime hours for that date
 * 4. All three items appear in the employee's dashboard/bookings
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const DeskService = require('../../src/backend/services/DeskService');
const BookingService = require('../../src/backend/services/BookingService');
const ParkingSpaceService = require('../../src/backend/services/ParkingSpaceService');
const ParkingReservationService = require('../../src/backend/services/ParkingReservationService');
const OvertimeService = require('../../src/backend/services/OvertimeService');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');
const OvertimeRecordRepository = require('../../src/backend/repositories/OvertimeRecordRepository');

describe('Use Case 7: Employee Books Desk, Parking Space, and Records Overtime', () => {
  let deskService;
  let bookingService;
  let parkingSpaceService;
  let reservationService;
  let overtimeService;
  let deskRepository;
  let bookingRepository;
  let parkingSpaceRepository;
  let reservationRepository;
  let overtimeRepository;
  let testDeskId;
  let testParkingSpaceId;
  let userToken;

  beforeAll(async () => {
    deskService = new DeskService();
    bookingService = new BookingService();
    parkingSpaceService = new ParkingSpaceService();
    reservationService = new ParkingReservationService();
    overtimeService = new OvertimeService();
    deskRepository = new DeskRepository();
    bookingRepository = new BookingRepository();
    parkingSpaceRepository = new ParkingSpaceRepository();
    reservationRepository = new ParkingReservationRepository();
    overtimeRepository = new OvertimeRecordRepository();

    // Create test desk
    const desk = await deskService.createDesk({
      deskNumber: 'UC7-D001',
      location: 'Floor 1 - Test Area',
      description: 'Test desk for Use Case 7',
      isActive: true,
    });
    testDeskId = desk.id;

    // Create test parking space
    const parkingSpace = await parkingSpaceService.createParkingSpace({
      spaceNumber: 'UC7-P001',
      location: 'Lot A - Test Area',
      description: 'Test parking space for Use Case 7',
      isActive: true,
    });
    testParkingSpaceId = parkingSpace.id;

    userToken = 'Bearer user_7001';
  });

  afterAll(async () => {
    // Cleanup
    try {
      const bookings = await bookingRepository.findAll();
      for (const booking of bookings) {
        if (booking.deskId === testDeskId) {
          await bookingRepository.delete(booking.id);
        }
      }
      
      const reservations = await reservationRepository.findAll();
      for (const reservation of reservations) {
        if (reservation.parkingSpaceId === testParkingSpaceId) {
          await reservationRepository.delete(reservation.id);
        }
      }
      
      const overtimeRecords = await overtimeRepository.findAll();
      for (const record of overtimeRecords) {
        if (record.userId === 1) {
          await overtimeRepository.delete(record.id);
        }
      }
      
      await deskRepository.delete(testDeskId);
      await parkingSpaceRepository.delete(testParkingSpaceId);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('Step 1-3: User can book a desk for a specific date', async () => {
    const reservationDate = '2026-12-15';
    const startDate = reservationDate;
    const endDate = reservationDate;

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', userToken)
      .send({
        deskId: testDeskId,
        startDate: startDate,
        endDate: endDate,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.deskId).toBe(testDeskId);
  });

  test('Step 4-5: User can reserve a parking space for the same date', async () => {
    const reservationDate = '2026-12-15';
    const timePeriod = 'full_day';

    const response = await request(app)
      .post('/api/parking-reservations')
      .set('Authorization', userToken)
      .send({
        parkingSpaceId: testParkingSpaceId,
        reservationDate: reservationDate,
        timePeriod: timePeriod,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.parkingSpaceId).toBe(testParkingSpaceId);
  });

  test('Step 6-14: User can record overtime hours', async () => {
    const recordDate = '2026-12-15';
    const startTime = '17:00:00';
    const endTime = '18:00:00';
    const description = 'Extended work on project';

    const response = await request(app)
      .post('/api/overtime')
      .set('Authorization', userToken)
      .send({
        recordDate: recordDate,
        startTime: startTime,
        endTime: endTime,
        description: description,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.recordDate).toBe(recordDate);
    expect(response.body.totalHours).toBe(1);
    expect(response.body.description).toBe(description);
    expect(response.body.status).toBe('pending');
  });

  test('Step 15: All three items appear in My Bookings', async () => {
    const bookingsResponse = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', userToken);

    expect(bookingsResponse.status).toBe(200);
    const userBooking = bookingsResponse.body.find(b => b.deskId === testDeskId);
    expect(userBooking).toBeDefined();

    const reservationsResponse = await request(app)
      .get('/api/parking-reservations/my-reservations')
      .set('Authorization', userToken);

    expect(reservationsResponse.status).toBe(200);
    const userReservation = reservationsResponse.body.find(r => r.parkingSpaceId === testParkingSpaceId);
    expect(userReservation).toBeDefined();

    const overtimeResponse = await request(app)
      .get('/api/overtime/my-overtime')
      .set('Authorization', userToken);

    expect(overtimeResponse.status).toBe(200);
    expect(Array.isArray(overtimeResponse.body)).toBe(true);
    const userOvertime = overtimeResponse.body.find(r => r.recordDate === '2026-12-15');
    expect(userOvertime).toBeDefined();
    expect(userOvertime.totalHours).toBe(1);
  });
});

