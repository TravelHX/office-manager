// MapService — Phase 23d.
//
// Orchestrates the floor plan, landmarks, and per-resource coordinates for
// a given context ('desk' | 'parking'). Validates the public surface so
// routes stay thin.
//
// File-system side: when a floor plan is uploaded the bytes are written
// under data/maps/. The service deletes prior images on replace; the
// caller (route) supplies the raw buffer + mime type.

const path = require('path');
const fs = require('fs');
// `fs.promises.*` is dereferenced inside each call (not captured here at
// module load) so `jest.mock('fs')` tests can stub the promises namespace
// after the module is required without breaking it.
const FloorPlanRepository = require('../repositories/FloorPlanRepository');
const MapLandmarkRepository = require('../repositories/MapLandmarkRepository');
const ResourceMapCoordinateRepository = require('../repositories/ResourceMapCoordinateRepository');
const DeskRepository = require('../repositories/DeskRepository');
const ParkingSpaceRepository = require('../repositories/ParkingSpaceRepository');
const MapLandmark = require('../models/MapLandmark');

const VALID_CONTEXTS = Object.freeze(['desk', 'parking']);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB hard cap, mirrors route limit
const ACCEPTED_MIME_TYPES = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
});

// `data/maps/` resolved relative to repo root so it works in dev (host bind
// mount) and in production (Docker copy).
const DATA_MAPS_ABS = path.resolve(__dirname, '..', '..', '..', 'data', 'maps');
// Path stored in the DB is relative to the data dir so it survives moves.
const DATA_MAPS_REL_PREFIX = 'maps';

class MapService {
  constructor() {
    this.floorPlanRepository = new FloorPlanRepository();
    this.landmarkRepository = new MapLandmarkRepository();
    this.coordinateRepository = new ResourceMapCoordinateRepository();
    this.deskRepository = new DeskRepository();
    this.parkingSpaceRepository = new ParkingSpaceRepository();
  }

  static get VALID_CONTEXTS() { return VALID_CONTEXTS; }
  static get MAX_IMAGE_BYTES() { return MAX_IMAGE_BYTES; }
  static get ACCEPTED_MIME_TYPES() { return ACCEPTED_MIME_TYPES; }

  static assertContext(context) {
    if (!VALID_CONTEXTS.includes(context)) {
      throw new Error(`Invalid context '${context}'. Expected one of: ${VALID_CONTEXTS.join(', ')}`);
    }
  }

  static assertNormalised(x, y) {
    const xn = Number(x);
    const yn = Number(y);
    if (!Number.isFinite(xn) || !Number.isFinite(yn) || xn < 0 || xn > 1 || yn < 0 || yn > 1) {
      throw new Error('Coordinates must be numbers in [0, 1] (normalised to image width/height)');
    }
    return { x: xn, y: yn };
  }

  /**
   * Aggregate everything an authenticated client needs to render the map for
   * a context: the image URL + version, all landmarks, and the placed
   * resources keyed by resource id.
   */
  async getConfiguration(context) {
    MapService.assertContext(context);
    const floorPlan = await this.floorPlanRepository.findByContext(context);
    const landmarks = await this.landmarkRepository.findByContext(context);
    const resources = await this.coordinateRepository.findByContext(context);
    return {
      context,
      floorPlan: floorPlan ? {
        url: `/api/maps/${context}/floor-plan/image?v=${floorPlan.imageVersion}`,
        mime: floorPlan.imageMime,
        version: floorPlan.imageVersion,
        uploadedAt: floorPlan.uploadedAt,
      } : null,
      landmarks: landmarks.map((l) => l.toJSON()),
      resources,
    };
  }

  /**
   * Locate the on-disk path for a context's floor plan (or null if no image
   * is configured). Routes use this to stream the image bytes.
   */
  async getFloorPlanFile(context) {
    MapService.assertContext(context);
    const fp = await this.floorPlanRepository.findByContext(context);
    if (!fp) return null;
    const abs = path.resolve(DATA_MAPS_ABS, '..', fp.imagePath);
    // Defensive: confirm the resolved path stays under data/.
    const dataAbs = path.resolve(DATA_MAPS_ABS, '..');
    if (!abs.startsWith(dataAbs)) {
      throw new Error('Floor plan path traversal detected');
    }
    try {
      await fs.promises.access(abs, fs.constants.R_OK);
    } catch (_) {
      return null;
    }
    return { path: abs, mime: fp.imageMime, version: fp.imageVersion };
  }

  /**
   * Replace the floor plan image for a context. Validates mime + size,
   * writes to disk, and bumps image_version. Returns the persisted row.
   */
  async replaceFloorPlan(context, imageBuffer, mimeType, uploadedBy) {
    MapService.assertContext(context);
    if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
      throw new Error('No image content provided');
    }
    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      throw new Error(`Image exceeds ${MAX_IMAGE_BYTES} byte limit`);
    }
    const ext = ACCEPTED_MIME_TYPES[mimeType];
    if (!ext) {
      throw new Error(`Unsupported image type '${mimeType}'. Allowed: ${Object.keys(ACCEPTED_MIME_TYPES).join(', ')}`);
    }
    // Defensive: PNG / JPEG magic-byte signature check so a rogue caller
    // can't claim image/png while sending HTML or something else.
    if (!hasImageMagicBytes(imageBuffer, mimeType)) {
      throw new Error('Image content does not match declared MIME type');
    }

    await fs.promises.mkdir(DATA_MAPS_ABS, { recursive: true });

    const previous = await this.floorPlanRepository.findByContext(context);

    // Filename: {context}-{nextVersion}.{ext}. Letting the version drive
    // the filename means we don't need to delete the old file synchronously
    // before writing — we can write the new file first, then unlink the old
    // one. If the unlink fails the new image is still live.
    const nextVersion = (previous?.imageVersion ?? 0) + 1;
    const fileName = `${context}-${nextVersion}.${ext}`;
    const relPath = `${DATA_MAPS_REL_PREFIX}/${fileName}`;
    const absPath = path.join(DATA_MAPS_ABS, fileName);

    await fs.promises.writeFile(absPath, imageBuffer);

    const persisted = await this.floorPlanRepository.upsert({
      context,
      imagePath: relPath,
      imageMime: mimeType,
      uploadedBy: uploadedBy ?? null,
    });

    if (previous && previous.imagePath && previous.imagePath !== relPath) {
      const oldAbs = path.resolve(DATA_MAPS_ABS, '..', previous.imagePath);
      try {
        await fs.promises.unlink(oldAbs);
      } catch (_) {
        // Best-effort cleanup; we don't fail the upload if removal fails.
      }
    }

    return persisted;
  }

  async deleteFloorPlan(context) {
    MapService.assertContext(context);
    const previous = await this.floorPlanRepository.findByContext(context);
    if (!previous) return false;
    const affected = await this.floorPlanRepository.deleteByContext(context);
    if (previous.imagePath) {
      const oldAbs = path.resolve(DATA_MAPS_ABS, '..', previous.imagePath);
      try { await fs.promises.unlink(oldAbs); } catch (_) { /* best-effort */ }
    }
    return affected > 0;
  }

  // ------------------------------------------------------------------
  // Landmarks
  // ------------------------------------------------------------------

  async listLandmarks(context) {
    MapService.assertContext(context);
    return (await this.landmarkRepository.findByContext(context)).map((l) => l.toJSON());
  }

  async createLandmark(context, { type, label, x, y }) {
    MapService.assertContext(context);
    if (!type || typeof type !== 'string' || !MapLandmark.TYPES.includes(type)) {
      throw new Error(`Landmark type must be one of: ${MapLandmark.TYPES.join(', ')}`);
    }
    if (type === 'custom' && (!label || !String(label).trim())) {
      throw new Error('Custom landmarks require a label');
    }
    const { x: xn, y: yn } = MapService.assertNormalised(x, y);
    const created = await this.landmarkRepository.create({
      context,
      type,
      label: label && String(label).trim() ? String(label).trim() : null,
      x: xn,
      y: yn,
    });
    return created.toJSON();
  }

  async updateLandmark(context, id, updates) {
    MapService.assertContext(context);
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(updates, 'type')) {
      if (!MapLandmark.TYPES.includes(updates.type)) {
        throw new Error(`Landmark type must be one of: ${MapLandmark.TYPES.join(', ')}`);
      }
      patch.type = updates.type;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
      patch.label = updates.label && String(updates.label).trim()
        ? String(updates.label).trim()
        : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'x') || Object.prototype.hasOwnProperty.call(updates, 'y')) {
      const { x: xn, y: yn } = MapService.assertNormalised(
        updates.x !== undefined ? updates.x : 0,
        updates.y !== undefined ? updates.y : 0,
      );
      if (Object.prototype.hasOwnProperty.call(updates, 'x')) patch.x = xn;
      if (Object.prototype.hasOwnProperty.call(updates, 'y')) patch.y = yn;
    }
    const updated = await this.landmarkRepository.update(id, context, patch);
    if (!updated) {
      throw new Error('Landmark not found');
    }
    return updated.toJSON();
  }

  async deleteLandmark(context, id) {
    MapService.assertContext(context);
    const affected = await this.landmarkRepository.deleteByIdAndContext(id, context);
    if (affected === 0) {
      throw new Error('Landmark not found');
    }
    return true;
  }

  // ------------------------------------------------------------------
  // Resource coordinates
  // ------------------------------------------------------------------

  async setResourceCoordinates(context, resourceId, x, y) {
    MapService.assertContext(context);
    const id = Number.parseInt(resourceId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error('Invalid resource id');
    }
    // Confirm the resource exists in its own table before writing a row.
    if (context === 'desk') {
      const desk = await this.deskRepository.findById(id);
      if (!desk) throw new Error('Desk not found');
    } else {
      const space = await this.parkingSpaceRepository.findById(id);
      if (!space) throw new Error('Parking space not found');
    }
    const { x: xn, y: yn } = MapService.assertNormalised(x, y);
    return await this.coordinateRepository.upsert(context, id, xn, yn);
  }

  async deleteResourceCoordinates(context, resourceId) {
    MapService.assertContext(context);
    const id = Number.parseInt(resourceId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error('Invalid resource id');
    }
    const affected = await this.coordinateRepository.deleteOne(context, id);
    if (affected === 0) {
      throw new Error('Resource coordinates not found');
    }
    return true;
  }
}

/**
 * Sniff the first few bytes of the buffer to confirm it really is the kind
 * of image its MIME type claims. Defends against a caller spoofing the
 * Content-Type header. We deliberately do not use a parsing library — the
 * goal is to reject obvious non-images, not validate every PNG/JPEG variant.
 */
function hasImageMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;
  if (mimeType === 'image/png') {
    // 89 50 4E 47 0D 0A 1A 0A
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47
    );
  }
  if (mimeType === 'image/jpeg') {
    // FF D8 FF
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  return false;
}

module.exports = MapService;
