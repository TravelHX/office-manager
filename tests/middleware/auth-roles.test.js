// Phase 26 unit tests for the authorization middleware role helpers.
//
// `authorize`, `requireAdmin`, and `requireOfficeAdminOrAdmin` are pure
// HTTP middleware: given a `req` shape they call `next()` for an
// authorised caller and respond 401/403 otherwise. We test them against
// representative `req.user` shapes for each of the three canonical roles
// plus the unauthenticated case.

const {
  authorize,
  requireAdmin,
  requireOfficeAdminOrAdmin,
} = require('../../src/backend/middleware/auth');

function makeReq(role) {
  if (!role) return {}; // unauthenticated
  return {
    user: {
      id: 1,
      username: 'tester@test.com',
      role,
      isAdmin: role === 'admin',
    },
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('Phase 26 role middleware', () => {
  describe('requireAdmin', () => {
    test('401 unauthenticated', (done) => {
      const res = makeRes();
      requireAdmin(makeReq(null), res, () => {
        done.fail('next() should not run');
      });
      // Need a microtask boundary: authorize calls next/res synchronously.
      setTimeout(() => {
        expect(res.statusCode).toBe(401);
        expect(res.body.error.code).toBe('AUTH_REQUIRED');
        done();
      }, 0);
    });

    test('403 for role=user', (done) => {
      const res = makeRes();
      requireAdmin(makeReq('user'), res, () => done.fail('next() should not run'));
      setTimeout(() => {
        expect(res.statusCode).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        done();
      }, 0);
    });

    test('403 for role=office_admin', (done) => {
      const res = makeRes();
      requireAdmin(makeReq('office_admin'), res, () => done.fail('OA must not pass requireAdmin'));
      setTimeout(() => {
        expect(res.statusCode).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        done();
      }, 0);
    });

    test('200 (next called) for role=admin', (done) => {
      const res = makeRes();
      requireAdmin(makeReq('admin'), res, () => done());
    });
  });

  describe('requireOfficeAdminOrAdmin', () => {
    test('401 unauthenticated', (done) => {
      const res = makeRes();
      requireOfficeAdminOrAdmin(makeReq(null), res, () => done.fail());
      setTimeout(() => {
        expect(res.statusCode).toBe(401);
        done();
      }, 0);
    });

    test('403 for role=user', (done) => {
      const res = makeRes();
      requireOfficeAdminOrAdmin(makeReq('user'), res, () => done.fail());
      setTimeout(() => {
        expect(res.statusCode).toBe(403);
        done();
      }, 0);
    });

    test('200 for role=office_admin', (done) => {
      requireOfficeAdminOrAdmin(makeReq('office_admin'), makeRes(), () => done());
    });

    test('200 for role=admin', (done) => {
      requireOfficeAdminOrAdmin(makeReq('admin'), makeRes(), () => done());
    });
  });

  describe('legacy authorize([\'admin\']) backwards compat', () => {
    test('still admits role=admin', (done) => {
      authorize(['admin'])(makeReq('admin'), makeRes(), () => done());
    });
    test('still rejects role=user with FORBIDDEN', (done) => {
      const res = makeRes();
      authorize(['admin'])(makeReq('user'), res, () => done.fail());
      setTimeout(() => {
        expect(res.body.error.code).toBe('FORBIDDEN');
        done();
      }, 0);
    });
    test('rejects role=office_admin (since [\'admin\'] is admin-only)', (done) => {
      const res = makeRes();
      authorize(['admin'])(makeReq('office_admin'), res, () => done.fail());
      setTimeout(() => {
        expect(res.body.error.code).toBe('FORBIDDEN');
        done();
      }, 0);
    });
  });
});
