// FloorPlan model (Phase 23d).
//
// One row per (context). The image itself lives on disk under data/maps/;
// imagePath is relative to that directory. Bumped image_version each time
// the file is replaced, so the client can cache-bust.

class FloorPlan {
  constructor(data = {}) {
    this.id = data.id;
    this.context = data.context;
    this.imagePath = data.image_path;
    this.imageMime = data.image_mime;
    this.imageVersion = data.image_version;
    this.uploadedBy = data.uploaded_by;
    this.uploadedAt = data.uploaded_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      context: this.context,
      imagePath: this.imagePath,
      imageMime: this.imageMime,
      imageVersion: this.imageVersion,
      uploadedBy: this.uploadedBy,
      uploadedAt: this.uploadedAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      context: this.context,
      image_path: this.imagePath,
      image_mime: this.imageMime,
      image_version: this.imageVersion,
      uploaded_by: this.uploadedBy,
    };
  }
}

module.exports = FloorPlan;
