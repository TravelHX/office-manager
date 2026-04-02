/**
 * Phase 17: Admin user deletion - end-to-end API scenarios
 * (17.27-17.34)
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');
const OvertimeRecordRepository = require('../../src/backend/repositories/OvertimeRecordRepository');
const Booking = require('../../src/backend/models/Booking');
const ParkingReservation = require('../../src/backend/models/ParkingReservation');
const OvertimeRecord = require('../../src/backend/models/OvertimeRecord');
const Desk = require('../../src/backend/models/Desk');
const ParkingSpace = require('../../src/backend/models/ParkingSpace');

describe('Phase 17: Admin user deletion (integration)', () => {
  let userService;
  let seedAdmin;
  let actorAdminToken;
  let suffix;

  beforeAll(async () => {
    userService = new UserService();
    seedAdmin = await userService.getUserByUsername('admin');
    if (!seedAdmin) {
      throw new Error('Seed admin user required for Phase 17 integration tests');
    }
    actorAdminToken = `Bearer ${generateToken(seedAdmin)}`;
    suffix = Date.now().toString(36);
  });

  describe('17.27 / 17.30: Admin deletes a regular user', () => {
    test('DELETE removes regular user and returns 204', async () => {
      const regular = await createProvisionedUserWithPassword(seedAdmin.id, {
        email: `p17_reg_${suffix}@test.com`,
        name: `P17 Reg ${suffix}`,
        password: 'Password123',
      });

      const res = await request(app)
        .delete(`/api/auth/users/${regular.id}`)
        .set('Authorization', actorAdminToken);

      expect(res.status).toBe(204);

      await expect(userService.getUserById(regular.id)).rejects.toThrow('User not found');
    });
  });

  describe('17.28 / 17.31: Admin deletes another admin when multiple admins exist', () => {
    test('DELETE removes second admin when at least two admins remain in system', async () => {
      const secondAdmin = await createProvisionedUserWithPassword(seedAdmin.id, {
        email: `p17_sa_${suffix}@test.com`,
        name: `P17 SA ${suffix}`,
        password: 'Password123',
        is_admin: true,
        role: 'admin',
      });

      const adminCountBefore = await userService.getAdminCount();
      expect(adminCountBefore).toBeGreaterThanOrEqual(2);

      const res = await request(app)
        .delete(`/api/auth/users/${secondAdmin.id}`)
        .set('Authorization', actorAdminToken);

      expect(res.status).toBe(204);
      await expect(userService.getUserById(secondAdmin.id)).rejects.toThrow('User not found');
    });
  });

  describe('17.29 / 17.32 / 17.33: Cannot delete last admin user', () => {
    test('returns 400 CANNOT_DELETE_LAST_ADMIN with clear message when only one admin remains', async () => {
      const extraAdmin = await createProvisionedUserWithPassword(seedAdmin.id, {
        email: `p17_lag_${suffix}b@test.com`,
        name: `P17 LAG ${suffix}`,
        password: 'Password123',
        is_admin: true,
        role: 'admin',
      });

      const spy = jest.spyOn(UserService.prototype, 'getAdminCount').mockResolvedValue(1);

      const res = await request(app)
        .delete(`/api/auth/users/${extraAdmin.id}`)
        .set('Authorization', actorAdminToken);

      spy.mockRestore();

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_DELETE_LAST_ADMIN');
      expect(res.body.error.message).toMatch(/last admin user/i);

      const cleanup = await request(app)
        .delete(`/api/auth/users/${extraAdmin.id}`)
        .set('Authorization', actorAdminToken);
      expect(cleanup.status).toBe(204);
    });
  });

  describe('17.34: Associated data removed when user is deleted (cascade)', () => {
    test('bookings, parking reservations, and overtime records are removed', async () => {
      const deskRepo = new DeskRepository();
      const bookingRepo = new BookingRepository();
      const spaceRepo = new ParkingSpaceRepository();
      const resRepo = new ParkingReservationRepository();
      const otRepo = new OvertimeRecordRepository();

      const victim = await createProvisionedUserWithPassword(seedAdmin.id, {
        email: `p17_c_${suffix}@test.com`,
        name: `P17 Cascade ${suffix}`,
        password: 'Password123',
      });

      let desk = await deskRepo.findAll();
      let deskId;
      if (!desk.length) {
        const created = await deskRepo.create(
          new Desk({ desk_number: `P17-C-${suffix}`, is_active: true })
        );
        deskId = created.id;
      } else {
        deskId = desk[0].id;
      }

      let spaces = await spaceRepo.findAll();
      let spaceId;
      if (!spaces.length) {
        const created = await spaceRepo.create(
          new ParkingSpace({ space_number: `P17-P-${suffix}`, is_active: true })
        );
        spaceId = created.id;
      } else {
        spaceId = spaces[0].id;
      }

      await bookingRepo.create(
        new Booking({
          user_id: victim.id,
          desk_id: deskId,
          start_date: '2027-06-01',
          end_date: '2027-06-02',
          status: 'active',
        })
      );

      await resRepo.create(
        new ParkingReservation({
          user_id: victim.id,
          parking_space_id: spaceId,
          reservation_date: '2027-06-03',
          time_period: 'morning',
          status: 'active',
        })
      );

      await otRepo.create(
        new OvertimeRecord({
          user_id: victim.id,
          record_date: '2027-06-04',
          start_time: '18:00:00',
          end_time: '20:00:00',
          total_hours: 2,
          description: 'phase 17 cascade test',
          status: 'pending',
        })
      );

      expect((await bookingRepo.findByUserId(victim.id)).length).toBeGreaterThan(0);
      expect((await resRepo.findByUserId(victim.id)).length).toBeGreaterThan(0);
      expect((await otRepo.findByUserId(victim.id)).length).toBeGreaterThan(0);

      const delRes = await request(app)
        .delete(`/api/auth/users/${victim.id}`)
        .set('Authorization', actorAdminToken);

      expect(delRes.status).toBe(204);

      expect((await bookingRepo.findByUserId(victim.id)).length).toBe(0);
      expect((await resRepo.findByUserId(victim.id)).length).toBe(0);
      expect((await otRepo.findByUserId(victim.id)).length).toBe(0);
    });
  });
});
