// Maps routes (Phase 23d).
//
// Two paths under one router file:
//
//   Public-but-authenticated:
//     GET  /api/maps/:context                  -> map config (image meta + landmarks + resources)
//     GET  /api/maps/:context/floor-plan/image -> raw image bytes (?v=N for cache-busting)
//
//   Admin-only:
//     POST   /api/admin/maps/:context/floor-plan          (raw PNG/JPG body)
//     DELETE /api/admin/maps/:context/floor-plan
//     GET    /api/admin/maps/:context                     (same shape as public, for the editor)
//     POST   /api/admin/maps/:context/landmarks
//     PUT    /api/admin/maps/:context/landmarks/:id
//     DELETE /api/admin/maps/:context/landmarks/:id
//     PUT    /api/admin/maps/:context/resources/:resourceId/coordinates
//     DELETE /api/admin/maps/:context/resources/:resourceId/coordinates
//
// The two routers are exported separately so server.js can mount them at
// the right base paths. Image upload uses `express.raw` so we don't need a
// multipart parser dependency; the client posts the file body directly with
// the appropriate Content-Type header.

const express = require('express');
const fs = require('fs');
const MapService = require('../services/MapService');
const { authenticate, authorize, requireCompleteProfile } = require('../middleware/auth');
const audit = require('../utils/audit-helper');

const mapService = new MapService();

const ACCEPTED_MIME = Object.keys(MapService.ACCEPTED_MIME_TYPES);

// ---------------------------------------------------------------------------
// Public router (mounted at /api/maps)
// ---------------------------------------------------------------------------

const publicRouter = express.Router();

publicRouter.get(
  '/:context',
  authenticate,
  requireCompleteProfile,
  async (req, res, next) => {
    try {
      const config = await mapService.getConfiguration(req.params.context);
      res.json(config);
    } catch (error) {
      if (error.message.startsWith('Invalid context')) {
        return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
      }
      next(error);
    }
  }
);

publicRouter.get(
  '/:context/floor-plan/image',
  authenticate,
  requireCompleteProfile,
  async (req, res, next) => {
    try {
      const file = await mapService.getFloorPlanFile(req.params.context);
      if (!file) {
        return res.status(404).json({
          error: { message: 'No floor plan configured for this context', code: 'NO_FLOOR_PLAN' },
        });
      }
      // Long-cache: the URL contains ?v=<version>, so each upload busts the cache.
      res.setHeader('Content-Type', file.mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      fs.createReadStream(file.path).pipe(res);
    } catch (error) {
      if (error.message.startsWith('Invalid context')) {
        return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
      }
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Admin router (mounted at /api/admin/maps)
// ---------------------------------------------------------------------------

const adminRouter = express.Router();

const adminGuards = [authenticate, requireCompleteProfile, authorize(['admin'])];

// Same payload shape as the public GET, exposed under /api/admin/ for the
// editor UI; keeps client logic simple and means both surfaces stay in sync.
adminRouter.get('/:context', ...adminGuards, async (req, res, next) => {
  try {
    res.json(await mapService.getConfiguration(req.params.context));
  } catch (error) {
    if (error.message.startsWith('Invalid context')) {
      return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
    }
    next(error);
  }
});

// Raw body upload: PNG / JPEG only, hard-capped at 2 MB. Client posts the
// file bytes directly with Content-Type: image/png (or image/jpeg).
adminRouter.post(
  '/:context/floor-plan',
  ...adminGuards,
  express.raw({ type: ACCEPTED_MIME, limit: MapService.MAX_IMAGE_BYTES }),
  async (req, res, next) => {
    try {
      const mimeType = req.headers['content-type'] || '';
      if (!ACCEPTED_MIME.includes(mimeType)) {
        return res.status(415).json({
          error: {
            message: `Content-Type must be one of: ${ACCEPTED_MIME.join(', ')}`,
            code: 'UNSUPPORTED_MEDIA_TYPE',
          },
        });
      }
      // express.raw resolves with a Buffer when the body matched its `type`
      // filter; otherwise req.body may be `{}` from earlier json/urlencoded
      // middleware. Detect that and reject.
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({
          error: { message: 'Request body must be the raw image bytes', code: 'EMPTY_BODY' },
        });
      }

      const persisted = await mapService.replaceFloorPlan(
        req.params.context,
        req.body,
        mimeType,
        req.user && req.user.id,
      );

      await audit.emit(req, {
        actionType: 'MAP_FLOOR_PLAN_UPLOADED',
        targetType: 'floor_plan',
        targetId: persisted.id,
        summary: `Uploaded ${req.params.context} floor plan v${persisted.imageVersion}`,
        payload: {
          context: req.params.context,
          image_mime: persisted.imageMime,
          image_version: persisted.imageVersion,
          image_bytes: req.body.length,
        },
      });

      res.status(200).json(persisted.toJSON());
    } catch (error) {
      if (error.message.startsWith('Invalid context')) {
        return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
      }
      if (
        error.message.includes('Image exceeds')
        || error.message.includes('Unsupported image type')
        || error.message.includes('No image content')
        || error.message.includes('does not match')
      ) {
        return res.status(400).json({ error: { message: error.message, code: 'INVALID_IMAGE' } });
      }
      // express.raw's payload-too-large error surfaces as type
      // 'entity.too.large' / status 413
      if (error.type === 'entity.too.large' || error.status === 413) {
        return res.status(413).json({
          error: { message: 'Floor plan image is too large', code: 'IMAGE_TOO_LARGE' },
        });
      }
      next(error);
    }
  }
);

adminRouter.delete('/:context/floor-plan', ...adminGuards, async (req, res, next) => {
  try {
    const removed = await mapService.deleteFloorPlan(req.params.context);
    if (!removed) {
      return res.status(404).json({
        error: { message: 'No floor plan to delete', code: 'NO_FLOOR_PLAN' },
      });
    }
    await audit.emit(req, {
      actionType: 'MAP_FLOOR_PLAN_DELETED',
      targetType: 'floor_plan',
      targetId: null,
      summary: `Deleted ${req.params.context} floor plan`,
      payload: { context: req.params.context },
    });
    res.status(204).send();
  } catch (error) {
    if (error.message.startsWith('Invalid context')) {
      return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
    }
    next(error);
  }
});

// ---- Landmarks ----

adminRouter.post('/:context/landmarks', ...adminGuards, async (req, res, next) => {
  try {
    const created = await mapService.createLandmark(req.params.context, req.body || {});
    await audit.emit(req, {
      actionType: 'MAP_LANDMARK_CREATED',
      targetType: 'landmark',
      targetId: created.id,
      summary: `Added ${created.type} landmark on ${req.params.context} map`,
      payload: { context: req.params.context, landmark_id: created.id, type: created.type, label: created.label },
    });
    res.status(201).json(created);
  } catch (error) {
    return mapValidationError(res, error, next);
  }
});

adminRouter.put('/:context/landmarks/:id', ...adminGuards, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: { message: 'Invalid landmark id', code: 'INVALID_LANDMARK_ID' } });
    }
    const updated = await mapService.updateLandmark(req.params.context, id, req.body || {});
    await audit.emit(req, {
      actionType: 'MAP_LANDMARK_UPDATED',
      targetType: 'landmark',
      targetId: id,
      summary: `Updated landmark on ${req.params.context} map`,
      payload: { context: req.params.context, landmark_id: id },
    });
    res.json(updated);
  } catch (error) {
    if (error.message === 'Landmark not found') {
      return res.status(404).json({ error: { message: error.message, code: 'LANDMARK_NOT_FOUND' } });
    }
    return mapValidationError(res, error, next);
  }
});

adminRouter.delete('/:context/landmarks/:id', ...adminGuards, async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: { message: 'Invalid landmark id', code: 'INVALID_LANDMARK_ID' } });
    }
    await mapService.deleteLandmark(req.params.context, id);
    await audit.emit(req, {
      actionType: 'MAP_LANDMARK_DELETED',
      targetType: 'landmark',
      targetId: id,
      summary: `Deleted landmark on ${req.params.context} map`,
      payload: { context: req.params.context, landmark_id: id },
    });
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Landmark not found') {
      return res.status(404).json({ error: { message: error.message, code: 'LANDMARK_NOT_FOUND' } });
    }
    if (error.message.startsWith('Invalid context')) {
      return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
    }
    next(error);
  }
});

// ---- Resource coordinates ----

adminRouter.put('/:context/resources/:resourceId/coordinates', ...adminGuards, async (req, res, next) => {
  try {
    const { x, y } = req.body || {};
    const persisted = await mapService.setResourceCoordinates(
      req.params.context,
      req.params.resourceId,
      x,
      y,
    );
    await audit.emit(req, {
      actionType: 'MAP_RESOURCE_COORDINATES_SET',
      targetType: req.params.context === 'desk' ? 'desk' : 'parking_space',
      targetId: persisted.resourceId,
      summary: `Set ${req.params.context} resource ${persisted.resourceId} coordinates`,
      payload: {
        context: req.params.context,
        resource_id: persisted.resourceId,
        x: persisted.x,
        y: persisted.y,
      },
    });
    res.json(persisted);
  } catch (error) {
    if (error.message === 'Desk not found' || error.message === 'Parking space not found') {
      return res.status(404).json({ error: { message: error.message, code: 'RESOURCE_NOT_FOUND' } });
    }
    return mapValidationError(res, error, next);
  }
});

adminRouter.delete('/:context/resources/:resourceId/coordinates', ...adminGuards, async (req, res, next) => {
  try {
    await mapService.deleteResourceCoordinates(req.params.context, req.params.resourceId);
    await audit.emit(req, {
      actionType: 'MAP_RESOURCE_COORDINATES_CLEARED',
      targetType: req.params.context === 'desk' ? 'desk' : 'parking_space',
      targetId: Number.parseInt(req.params.resourceId, 10) || null,
      summary: `Cleared ${req.params.context} resource coordinates`,
      payload: {
        context: req.params.context,
        resource_id: Number.parseInt(req.params.resourceId, 10),
      },
    });
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Resource coordinates not found') {
      return res.status(404).json({ error: { message: error.message, code: 'COORDINATES_NOT_FOUND' } });
    }
    if (error.message.startsWith('Invalid context')) {
      return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
    }
    if (error.message.includes('Invalid resource id')) {
      return res.status(400).json({ error: { message: error.message, code: 'INVALID_RESOURCE_ID' } });
    }
    next(error);
  }
});

function mapValidationError(res, error, next) {
  if (error.message.startsWith('Invalid context')) {
    return res.status(400).json({ error: { message: error.message, code: 'INVALID_CONTEXT' } });
  }
  if (
    error.message.includes('Coordinates must be')
    || error.message.includes('Landmark type must be')
    || error.message.includes('Custom landmarks require')
    || error.message.includes('Invalid resource id')
  ) {
    return res.status(400).json({ error: { message: error.message, code: 'VALIDATION_ERROR' } });
  }
  return next(error);
}

module.exports = { publicRouter, adminRouter };
