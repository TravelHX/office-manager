// ResourceMapCoordinateRepository — small wrapper for both desk and parking
// space coordinate tables. The schema is identical aside from the resource
// id column name, so one class with a `context` switch keeps this thin.
//
// Each row is keyed by the resource id (PRIMARY KEY); ON DUPLICATE KEY UPDATE
// is used for upserts so a "set position" call always succeeds whether or
// not the resource has previously been placed.

const BaseRepository = require('../data-access/base-repository');

const TABLE_BY_CONTEXT = Object.freeze({
  desk: { table: 'desk_map_coordinates', idColumn: 'desk_id' },
  parking: { table: 'parking_space_map_coordinates', idColumn: 'parking_space_id' },
});

class ResourceMapCoordinateRepository extends BaseRepository {
  constructor() {
    super('desk_map_coordinates'); // base table name; queries below pick the right one
  }

  static contextMeta(context) {
    const meta = TABLE_BY_CONTEXT[context];
    if (!meta) {
      throw new Error(`Unknown map context: ${context}`);
    }
    return meta;
  }

  async findByContext(context) {
    const { table, idColumn } = ResourceMapCoordinateRepository.contextMeta(context);
    const rows = await this.executeRawQuery(
      `SELECT ${idColumn} AS resource_id, x_norm, y_norm, updated_at FROM ${table} ORDER BY ${idColumn}`
    );
    return rows.map((row) => ({
      resourceId: row.resource_id,
      x: row.x_norm !== null && row.x_norm !== undefined ? Number(row.x_norm) : null,
      y: row.y_norm !== null && row.y_norm !== undefined ? Number(row.y_norm) : null,
      updatedAt: row.updated_at,
    }));
  }

  async findOne(context, resourceId) {
    const { table, idColumn } = ResourceMapCoordinateRepository.contextMeta(context);
    const rows = await this.executeRawQuery(
      `SELECT ${idColumn} AS resource_id, x_norm, y_norm, updated_at FROM ${table} WHERE ${idColumn} = ? LIMIT 1`,
      [resourceId]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      resourceId: row.resource_id,
      x: Number(row.x_norm),
      y: Number(row.y_norm),
      updatedAt: row.updated_at,
    };
  }

  /**
   * Insert or replace a coordinate row for a resource. Returns the
   * persisted record.
   */
  async upsert(context, resourceId, x, y) {
    const { table, idColumn } = ResourceMapCoordinateRepository.contextMeta(context);
    const sql = `
      INSERT INTO ${table} (${idColumn}, x_norm, y_norm)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE x_norm = VALUES(x_norm), y_norm = VALUES(y_norm)
    `;
    await this.executeRawQuery(sql, [resourceId, x, y]);
    return await this.findOne(context, resourceId);
  }

  async deleteOne(context, resourceId) {
    const { table, idColumn } = ResourceMapCoordinateRepository.contextMeta(context);
    const result = await this.executeRawQuery(
      `DELETE FROM ${table} WHERE ${idColumn} = ?`,
      [resourceId]
    );
    return result && result.affectedRows ? result.affectedRows : 0;
  }
}

module.exports = ResourceMapCoordinateRepository;
module.exports.CONTEXTS = Object.freeze(Object.keys(TABLE_BY_CONTEXT));
