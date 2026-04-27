// Phase 23d unit tests for MapService.
//
// File-system writes are stubbed via `jest.mock('fs')`. Repositories are
// auto-mocked and returned from instance fields. Tests focus on business
// rules: context validation, mime / size / magic-bytes enforcement, version
// bumping, landmark validation, coordinate normalisation, and the resource-
// existence pre-check before placing a marker.

jest.mock('fs');
jest.mock('../../src/backend/repositories/FloorPlanRepository');
jest.mock('../../src/backend/repositories/MapLandmarkRepository');
jest.mock('../../src/backend/repositories/ResourceMapCoordinateRepository');
jest.mock('../../src/backend/repositories/DeskRepository');
jest.mock('../../src/backend/repositories/ParkingSpaceRepository');

const fs = require('fs');
const MapService = require('../../src/backend/services/MapService');
const FloorPlanRepository = require('../../src/backend/repositories/FloorPlanRepository');
const MapLandmarkRepository = require('../../src/backend/repositories/MapLandmarkRepository');
const ResourceMapCoordinateRepository = require('../../src/backend/repositories/ResourceMapCoordinateRepository');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const FloorPlan = require('../../src/backend/models/FloorPlan');
const MapLandmark = require('../../src/backend/models/MapLandmark');

// Magic-byte buffers used to simulate valid and invalid image content.
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const JPEG_HEADER = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
const NOT_AN_IMAGE = Buffer.from('<html>not an image</html>');

describe('MapService (Phase 23d)', () => {
  let service;
  let floorPlanRepo;
  let landmarkRepo;
  let coordinateRepo;
  let deskRepo;
  let spaceRepo;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default fs promises: succeed for mkdir, writeFile, unlink, access.
    if (!fs.promises) fs.promises = {};
    fs.promises.mkdir = jest.fn().mockResolvedValue();
    fs.promises.writeFile = jest.fn().mockResolvedValue();
    fs.promises.unlink = jest.fn().mockResolvedValue();
    fs.promises.access = jest.fn().mockResolvedValue();
    fs.constants = { R_OK: 4 };

    floorPlanRepo = new FloorPlanRepository();
    landmarkRepo = new MapLandmarkRepository();
    coordinateRepo = new ResourceMapCoordinateRepository();
    deskRepo = new DeskRepository();
    spaceRepo = new ParkingSpaceRepository();

    service = new MapService();
    service.floorPlanRepository = floorPlanRepo;
    service.landmarkRepository = landmarkRepo;
    service.coordinateRepository = coordinateRepo;
    service.deskRepository = deskRepo;
    service.parkingSpaceRepository = spaceRepo;
  });

  describe('context validation', () => {
    test('rejects unknown context on getConfiguration', async () => {
      await expect(service.getConfiguration('lobby')).rejects.toThrow(/Invalid context/);
    });

    test('accepts both supported contexts', async () => {
      floorPlanRepo.findByContext = jest.fn().mockResolvedValue(null);
      landmarkRepo.findByContext = jest.fn().mockResolvedValue([]);
      coordinateRepo.findByContext = jest.fn().mockResolvedValue([]);
      await service.getConfiguration('desk');
      await service.getConfiguration('parking');
      expect(floorPlanRepo.findByContext).toHaveBeenCalledWith('desk');
      expect(floorPlanRepo.findByContext).toHaveBeenCalledWith('parking');
    });
  });

  describe('getConfiguration', () => {
    test('returns null floor plan + empty arrays when nothing configured', async () => {
      floorPlanRepo.findByContext = jest.fn().mockResolvedValue(null);
      landmarkRepo.findByContext = jest.fn().mockResolvedValue([]);
      coordinateRepo.findByContext = jest.fn().mockResolvedValue([]);
      const config = await service.getConfiguration('desk');
      expect(config).toEqual({
        context: 'desk',
        floorPlan: null,
        landmarks: [],
        resources: [],
      });
    });

    test('aggregates floor plan, landmarks, and resources when present', async () => {
      floorPlanRepo.findByContext = jest.fn().mockResolvedValue(new FloorPlan({
        id: 1, context: 'desk', image_path: 'maps/desk-3.png', image_mime: 'image/png',
        image_version: 3, uploaded_by: 7, uploaded_at: '2026-04-24T00:00:00Z',
      }));
      landmarkRepo.findByContext = jest.fn().mockResolvedValue([
        new MapLandmark({ id: 11, context: 'desk', type: 'lift', label: null, x_norm: 0.5, y_norm: 0.25 }),
      ]);
      coordinateRepo.findByContext = jest.fn().mockResolvedValue([
        { resourceId: 100, x: 0.1, y: 0.2 },
      ]);

      const config = await service.getConfiguration('desk');
      expect(config.floorPlan.url).toBe('/api/maps/desk/floor-plan/image?v=3');
      expect(config.floorPlan.mime).toBe('image/png');
      expect(config.floorPlan.version).toBe(3);
      expect(config.landmarks).toHaveLength(1);
      expect(config.landmarks[0]).toMatchObject({ id: 11, type: 'lift', x: 0.5, y: 0.25 });
      expect(config.resources).toEqual([{ resourceId: 100, x: 0.1, y: 0.2 }]);
    });
  });

  describe('replaceFloorPlan', () => {
    test('writes file, persists row, and returns the new floor plan record', async () => {
      floorPlanRepo.findByContext = jest.fn().mockResolvedValueOnce(null);
      const created = new FloorPlan({
        id: 1, context: 'desk', image_path: 'maps/desk-1.png', image_mime: 'image/png', image_version: 1,
      });
      floorPlanRepo.upsert = jest.fn().mockResolvedValue(created);

      const result = await service.replaceFloorPlan('desk', PNG_HEADER, 'image/png', 42);

      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(floorPlanRepo.upsert).toHaveBeenCalledWith({
        context: 'desk',
        imagePath: 'maps/desk-1.png',
        imageMime: 'image/png',
        uploadedBy: 42,
      });
      expect(result).toBe(created);
    });

    test('bumps version and unlinks previous file when replacing', async () => {
      floorPlanRepo.findByContext = jest.fn().mockResolvedValueOnce(new FloorPlan({
        id: 1, context: 'desk', image_path: 'maps/desk-1.png', image_mime: 'image/png', image_version: 1,
      }));
      floorPlanRepo.upsert = jest.fn().mockResolvedValue(new FloorPlan({
        id: 1, context: 'desk', image_path: 'maps/desk-2.png', image_mime: 'image/png', image_version: 2,
      }));

      await service.replaceFloorPlan('desk', PNG_HEADER, 'image/png', 42);

      // Wrote the next-version filename (desk-2.png).
      const writtenPath = fs.promises.writeFile.mock.calls[0][0];
      expect(String(writtenPath)).toMatch(/desk-2\.png$/);
      // Removed the previous file.
      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    test('rejects empty buffer', async () => {
      await expect(service.replaceFloorPlan('desk', Buffer.alloc(0), 'image/png', 1))
        .rejects.toThrow('No image content');
    });

    test('rejects oversized buffer', async () => {
      const huge = Buffer.alloc(MapService.MAX_IMAGE_BYTES + 1, 0);
      // Even before magic-byte check, length is enforced; PNG header at start
      // wouldn't change the result here.
      await expect(service.replaceFloorPlan('desk', huge, 'image/png', 1))
        .rejects.toThrow(/Image exceeds/);
    });

    test('rejects unsupported mime type', async () => {
      await expect(service.replaceFloorPlan('desk', PNG_HEADER, 'image/gif', 1))
        .rejects.toThrow(/Unsupported image type/);
    });

    test('rejects body whose magic bytes do not match declared mime', async () => {
      await expect(service.replaceFloorPlan('desk', NOT_AN_IMAGE, 'image/png', 1))
        .rejects.toThrow(/does not match declared/);
    });

    test('accepts valid JPEG content with image/jpeg mime', async () => {
      floorPlanRepo.findByContext = jest.fn().mockResolvedValue(null);
      floorPlanRepo.upsert = jest.fn().mockResolvedValue(new FloorPlan({
        id: 1, context: 'parking', image_path: 'maps/parking-1.jpg', image_mime: 'image/jpeg', image_version: 1,
      }));
      await service.replaceFloorPlan('parking', JPEG_HEADER, 'image/jpeg', 1);
      expect(floorPlanRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({
        imageMime: 'image/jpeg',
      }));
    });
  });

  describe('landmarks', () => {
    test('createLandmark validates type', async () => {
      await expect(service.createLandmark('desk', { type: 'helipad', x: 0.1, y: 0.1 }))
        .rejects.toThrow(/Landmark type must be one of/);
    });

    test('createLandmark requires label for custom type', async () => {
      await expect(service.createLandmark('desk', { type: 'custom', x: 0.1, y: 0.1 }))
        .rejects.toThrow(/Custom landmarks require a label/);
    });

    test('createLandmark validates coordinates are within [0, 1]', async () => {
      await expect(service.createLandmark('desk', { type: 'lift', x: 1.5, y: 0.5 }))
        .rejects.toThrow(/Coordinates must be/);
      await expect(service.createLandmark('desk', { type: 'lift', x: -0.1, y: 0.5 }))
        .rejects.toThrow(/Coordinates must be/);
    });

    test('createLandmark trims label and stores normalised coords', async () => {
      const created = new MapLandmark({ id: 1, context: 'desk', type: 'lift', label: 'Main lift', x_norm: 0.4, y_norm: 0.5 });
      landmarkRepo.create = jest.fn().mockResolvedValue(created);
      const result = await service.createLandmark('desk', { type: 'lift', label: '  Main lift  ', x: 0.4, y: 0.5 });
      expect(landmarkRepo.create).toHaveBeenCalledWith({
        context: 'desk',
        type: 'lift',
        label: 'Main lift',
        x: 0.4,
        y: 0.5,
      });
      expect(result.id).toBe(1);
    });

    test('updateLandmark throws when not found', async () => {
      landmarkRepo.update = jest.fn().mockResolvedValue(null);
      await expect(service.updateLandmark('desk', 99, { type: 'lift' }))
        .rejects.toThrow('Landmark not found');
    });

    test('deleteLandmark throws when not found', async () => {
      landmarkRepo.deleteByIdAndContext = jest.fn().mockResolvedValue(0);
      await expect(service.deleteLandmark('desk', 99)).rejects.toThrow('Landmark not found');
    });
  });

  describe('resource coordinates', () => {
    test('rejects non-numeric resource ids', async () => {
      await expect(service.setResourceCoordinates('desk', 'abc', 0.1, 0.1))
        .rejects.toThrow(/Invalid resource id/);
    });

    test('rejects unknown desk', async () => {
      deskRepo.findById = jest.fn().mockResolvedValue(null);
      await expect(service.setResourceCoordinates('desk', 7, 0.1, 0.1))
        .rejects.toThrow('Desk not found');
    });

    test('rejects unknown parking space', async () => {
      spaceRepo.findById = jest.fn().mockResolvedValue(null);
      await expect(service.setResourceCoordinates('parking', 7, 0.1, 0.1))
        .rejects.toThrow('Parking space not found');
    });

    test('upserts when desk exists', async () => {
      deskRepo.findById = jest.fn().mockResolvedValue({ id: 7 });
      coordinateRepo.upsert = jest.fn().mockResolvedValue({ resourceId: 7, x: 0.4, y: 0.6 });
      const result = await service.setResourceCoordinates('desk', 7, 0.4, 0.6);
      expect(coordinateRepo.upsert).toHaveBeenCalledWith('desk', 7, 0.4, 0.6);
      expect(result).toEqual({ resourceId: 7, x: 0.4, y: 0.6 });
    });

    test('deleteResourceCoordinates throws when none present', async () => {
      coordinateRepo.deleteOne = jest.fn().mockResolvedValue(0);
      await expect(service.deleteResourceCoordinates('desk', 7))
        .rejects.toThrow('Resource coordinates not found');
    });
  });
});
