// MapLandmark model (Phase 23d).
//
// Landmark markers placed by admins for orientation only — they do NOT
// intercept clicks on desk / parking markers in the UI (spec §17). Users
// see them; only admins can create / edit / delete.

class MapLandmark {
  /**
   * Allowed landmark types. The catalogue can grow without a schema change
   * because the column is VARCHAR; this list is the canonical set the UI
   * should offer in a picker. `custom` covers anything not in the preset
   * list and is paired with a `label` from the admin.
   */
  static TYPES = Object.freeze([
    'toilet',
    'lift',
    'stairs',
    'exit',
    'kitchen',
    'reception',
    'meeting_room',
    'first_aid',
    'custom',
  ]);

  constructor(data = {}) {
    this.id = data.id;
    this.context = data.context;
    this.type = data.type;
    this.label = data.label;
    // x_norm / y_norm come back from MySQL as strings for DECIMAL columns.
    // Coerce to numbers so the API surface is uniformly JS numbers.
    this.x = data.x_norm !== undefined && data.x_norm !== null ? Number(data.x_norm) : data.x;
    this.y = data.y_norm !== undefined && data.y_norm !== null ? Number(data.y_norm) : data.y;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      context: this.context,
      type: this.type,
      label: this.label,
      x: this.x,
      y: this.y,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      context: this.context,
      type: this.type,
      label: this.label,
      x_norm: this.x,
      y_norm: this.y,
    };
  }
}

module.exports = MapLandmark;
