// Phase 27b: persistence layer for the fob_inventory table.
//
// Two row "shapes" share the table:
//   - The default row has `date IS NULL`. There is at most one such row.
//   - Per-date overrides have a non-null `date`. Each (date) is unique.
//
// MySQL's UNIQUE constraint on a NULLable column allows multiple NULLs,
// so the application enforces single-default-row semantics by upserting
// against a `date IS NULL` predicate rather than relying on the index.

const BaseRepository = require('../data-access/base-repository');

class FobInventoryRepository extends BaseRepository {
  constructor() {
    super('fob_inventory');
  }

  /**
   * Read the default row (the one with `date IS NULL`). Returns null
   * when no default has been configured.
   * @returns {Promise<{count: number} | null>}
   */
  async getDefault() {
    const rows = await this.executeRawQuery(
      'SELECT count FROM fob_inventory WHERE date IS NULL LIMIT 1'
    );
    if (rows.length === 0) return null;
    return { count: parseInt(rows[0].count, 10) };
  }

  /**
   * Read the per-date override for the given date, or null when no
   * override exists.
   * @param {string} date `YYYY-MM-DD`
   * @returns {Promise<{date: string, count: number} | null>}
   */
  async getOverrideForDate(date) {
    const rows = await this.executeRawQuery(
      'SELECT date, count FROM fob_inventory WHERE date = ? LIMIT 1',
      [date]
    );
    if (rows.length === 0) return null;
    return { date: this._formatDate(rows[0].date), count: parseInt(rows[0].count, 10) };
  }

  /**
   * Read all per-date overrides. Useful for admin "Fob Management" UI.
   * @returns {Promise<Array<{date: string, count: number}>>}
   */
  async getAllOverrides() {
    const rows = await this.executeRawQuery(
      'SELECT date, count FROM fob_inventory WHERE date IS NOT NULL ORDER BY date ASC'
    );
    return rows.map((r) => ({ date: this._formatDate(r.date), count: parseInt(r.count, 10) }));
  }

  /**
   * Read overrides whose date falls inside [startDate, endDate]
   * inclusive. Used by the calendar / availability aggregation.
   */
  async getAllOverridesInRange(startDate, endDate) {
    const rows = await this.executeRawQuery(
      'SELECT date, count FROM fob_inventory WHERE date IS NOT NULL AND date BETWEEN ? AND ? ORDER BY date ASC',
      [startDate, endDate]
    );
    return rows.map((r) => ({ date: this._formatDate(r.date), count: parseInt(r.count, 10) }));
  }

  /**
   * Insert or update the single default row. Implemented as a
   * conditional UPDATE-then-INSERT rather than `INSERT ... ON DUPLICATE
   * KEY UPDATE` because the unique index on a NULLable column doesn't
   * trigger ON DUPLICATE KEY for NULLs in MySQL.
   */
  async upsertDefault(count, updatedBy) {
    const existing = await this.executeRawQuery(
      'SELECT id FROM fob_inventory WHERE date IS NULL LIMIT 1'
    );
    if (existing.length > 0) {
      await this.executeRawQuery(
        'UPDATE fob_inventory SET count = ?, updated_by = ? WHERE id = ?',
        [count, updatedBy, existing[0].id]
      );
    } else {
      await this.executeRawQuery(
        'INSERT INTO fob_inventory (date, count, updated_by) VALUES (NULL, ?, ?)',
        [count, updatedBy]
      );
    }
    return this.getDefault();
  }

  /**
   * Insert or update the override for `date`. The UNIQUE index on
   * `date` (non-null) is honoured by ON DUPLICATE KEY UPDATE.
   */
  async upsertOverride(date, count, updatedBy) {
    await this.executeRawQuery(
      `INSERT INTO fob_inventory (date, count, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE count = VALUES(count), updated_by = VALUES(updated_by)`,
      [date, count, updatedBy]
    );
    return this.getOverrideForDate(date);
  }

  /**
   * Drop the override for `date`. Returns true regardless of whether
   * a row was actually removed (idempotent at the API layer).
   */
  async deleteOverride(date) {
    await this.executeRawQuery(
      'DELETE FROM fob_inventory WHERE date = ?',
      [date]
    );
    return true;
  }

  /**
   * mysql2's DATE columns deserialise as `Date` objects (UTC midnight).
   * The rest of the app passes dates around as `YYYY-MM-DD` strings, so
   * we normalise on the way out of the repo to keep the contract stable.
   */
  _formatDate(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.length >= 10 ? value.substring(0, 10) : value;
    if (value instanceof Date) {
      const yyyy = value.getUTCFullYear();
      const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(value.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(value);
  }
}

module.exports = FobInventoryRepository;
