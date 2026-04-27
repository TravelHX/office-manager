// FloorPlanRepository — CRUD for the per-context floor plan row.
//
// The table has a UNIQUE(context) constraint so each context has at most one
// row at a time. Replace happens via INSERT … ON DUPLICATE KEY UPDATE so the
// flow is single-statement and concurrent uploads are safe.

const BaseRepository = require('../data-access/base-repository');
const FloorPlan = require('../models/FloorPlan');

class FloorPlanRepository extends BaseRepository {
  constructor() {
    super('floor_plans');
  }

  async findByContext(context) {
    const rows = await this.executeRawQuery(
      'SELECT * FROM floor_plans WHERE context = ? LIMIT 1',
      [context]
    );
    return rows.length > 0 ? new FloorPlan(rows[0]) : null;
  }

  /**
   * Insert or replace the floor plan row for a context.
   * @param {Object} params
   * @param {string} params.context     'desk' | 'parking'
   * @param {string} params.imagePath   relative path under data/maps/
   * @param {string} params.imageMime   'image/png' | 'image/jpeg'
   * @param {number|null} params.uploadedBy users.id of the admin who uploaded
   * @returns {Promise<FloorPlan>}      the persisted (post-version-bump) row
   */
  async upsert({ context, imagePath, imageMime, uploadedBy }) {
    // Bump version on every write so clients can cache-bust the URL. We
    // compute the next version explicitly rather than via SQL expression so
    // a freshly-inserted row gets version=1 and an existing row gets
    // existing+1, both atomically inside one statement.
    const sql = `
      INSERT INTO floor_plans (context, image_path, image_mime, image_version, uploaded_by)
      VALUES (?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        image_path = VALUES(image_path),
        image_mime = VALUES(image_mime),
        image_version = image_version + 1,
        uploaded_by = VALUES(uploaded_by)
    `;
    await this.executeRawQuery(sql, [context, imagePath, imageMime, uploadedBy ?? null]);
    return await this.findByContext(context);
  }

  async deleteByContext(context) {
    const sql = 'DELETE FROM floor_plans WHERE context = ?';
    const result = await this.executeRawQuery(sql, [context]);
    // mysql2 returns { affectedRows }; surface it so the caller can decide
    // between 200 and 404.
    return result && result.affectedRows ? result.affectedRows : 0;
  }
}

module.exports = FloorPlanRepository;
