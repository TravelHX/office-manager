const express = require('express');
const router = express.Router();
const desksRouter = require('./desks');
const bookingsRouter = require('./bookings');
const parkingSpacesRouter = require('./parking-spaces');
const parkingReservationsRouter = require('./parking-reservations');
const adminRouter = require('./admin');
const auditRouter = require('./audit');
const authRouter = require('./auth');
const matrixRouter = require('./matrix');
const versionRouter = require('./version');
const releaseHistoryRouter = require('./release-history');
const { publicRouter: mapsPublicRouter, adminRouter: mapsAdminRouter } = require('./maps');
const { readDeploymentVersion } = require('../utils/deployment-config');

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

router.get('/api', (req, res) => {
  res.json({
    message: 'Office Manager API',
    version: readDeploymentVersion(),
  });
});

router.use('/api/auth', authRouter);
router.use('/api/desks', desksRouter);
router.use('/api/bookings', bookingsRouter);
router.use('/api/parking-spaces', parkingSpacesRouter);
router.use('/api/parking-reservations', parkingReservationsRouter);
router.use('/api/admin', adminRouter);
router.use('/api/admin/audit-events', auditRouter);
// Phase 23d: floor plan map APIs. Mount admin router BEFORE the public one
// so /api/admin/maps/* never falls through to the public read-only handler.
router.use('/api/admin/maps', mapsAdminRouter);
router.use('/api/maps', mapsPublicRouter);
router.use('/api/matrix', matrixRouter);
router.use('/api/version', versionRouter);
router.use('/api/release-history', releaseHistoryRouter);

module.exports = router;

