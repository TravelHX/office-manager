// MapLandmarkRepository — CRUD over map_landmarks.
//
// Landmarks are scoped to a context ('desk' | 'parking'). Coordinates are
// normalized [0, 1] as DECIMAL(8,6); the service layer is responsible for
// validating the range before this repository is called.

const BaseRepository = require('../data-access/base-repository');
const MapLandmark = require('../models/MapLandmark');

class MapLandmarkRepository extends BaseRepository {
  constructor() {
    super('map_landmarks');
  }

  async findById(id) {
    const rows = await this.executeRawQuery(
      'SELECT * FROM map_landmarks WHERE id = ? LIMIT 1',
      [id]
    );
    return rows.length > 0 ? new MapLandmark(rows[0]) : null;
  }

  async findByContext(context) {
    const rows = await this.executeRawQuery(
      'SELECT * FROM map_landmarks WHERE context = ? ORDER BY id',
      [context]
    );
    return rows.map((row) => new MapLandmark(row));
  }

  async create({ context, type, label, x, y }) {
    const sql = `
      INSERT INTO map_landmarks (context, type, label, x_norm, y_norm)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await this.executeRawQuery(sql, [context, type, label ?? null, x, y]);
    return await this.findById(result.insertId);
  }

  /**
   * Patch an existing landmark. Only fields supplied in `updates` are written.
   * Returns the updated row, or null if no row matched the id+context pair.
   */
  async update(id, context, updates) {
    const fields = [];
    const params = [];
    if (Object.prototype.hasOwnProperty.call(updates, 'type')) {
      fields.push('type = ?');
      params.push(updates.type);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
      fields.push('label = ?');
      params.push(updates.label ?? null);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'x')) {
      fields.push('x_norm = ?');
      params.push(updates.x);
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'y')) {
      fields.push('y_norm = ?');
      params.push(updates.y);
    }
    if (fields.length === 0) {
      return await this.findById(id);
    }
    params.push(id, context);
    const sql = `UPDATE map_landmarks SET ${fields.join(', ')} WHERE id = ? AND context = ?`;
    const result = await this.executeRawQuery(sql, params);
    if (!result || result.affectedRows === 0) return null;
    return await this.findById(id);
  }

  async deleteByIdAndContext(id, context) {
    const result = await this.executeRawQuery(
      'DELETE FROM map_landmarks WHERE id = ? AND context = ?',
      [id, context]
    );
    return result && result.affectedRows ? result.affectedRows : 0;
  }
}

module.exports = MapLandmarkRepository;
