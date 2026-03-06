const BaseRepository = require('../data-access/base-repository');
const OvertimeRecord = require('../models/OvertimeRecord');

class OvertimeRecordRepository extends BaseRepository {
  constructor() {
    super('overtime_records');
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new OvertimeRecord(result) : null;
  }

  async findByUserId(userId) {
    const query = `
      SELECT * FROM overtime_records 
      WHERE user_id = ? 
      ORDER BY record_date DESC, created_at DESC
    `;
    const results = await this.executeRawQuery(query, [userId]);
    return results.map(row => new OvertimeRecord(row));
  }

  async findByUserIdAndDateRange(userId, startDate, endDate) {
    const query = `
      SELECT * FROM overtime_records 
      WHERE user_id = ? 
        AND record_date >= ? 
        AND record_date <= ?
      ORDER BY record_date DESC, created_at DESC
    `;
    const results = await this.executeRawQuery(query, [userId, startDate, endDate]);
    return results.map(row => new OvertimeRecord(row));
  }

  async findByStatus(status) {
    const query = `
      SELECT ot.*, u.username 
      FROM overtime_records ot
      JOIN users u ON ot.user_id = u.id
      WHERE ot.status = ?
      ORDER BY ot.record_date DESC, ot.created_at DESC
    `;
    const results = await this.executeRawQuery(query, [status]);
    return results.map(row => ({
      ...new OvertimeRecord(row).toJSON(),
      username: row.username,
    }));
  }

  async create(overtimeRecord) {
    const data = overtimeRecord instanceof OvertimeRecord ? overtimeRecord.toDatabaseFormat() : overtimeRecord;
    const id = await super.create(data);
    return this.findById(id);
  }

  async update(id, overtimeRecord) {
    const data = overtimeRecord instanceof OvertimeRecord ? overtimeRecord.toDatabaseFormat() : overtimeRecord;
    await super.update(id, data);
    return this.findById(id);
  }

  async approve(id, approvedBy) {
    const query = `
      UPDATE overtime_records 
      SET status = 'approved', 
          approved_at = NOW(), 
          approved_by = ?
      WHERE id = ?
    `;
    await this.executeRawQuery(query, [approvedBy, id]);
    return this.findById(id);
  }

  async reject(id, approvedBy) {
    const query = `
      UPDATE overtime_records 
      SET status = 'rejected', 
          approved_at = NOW(), 
          approved_by = ?
      WHERE id = ?
    `;
    await this.executeRawQuery(query, [approvedBy, id]);
    return this.findById(id);
  }

  async findAll() {
    const query = `
      SELECT ot.*, u.username 
      FROM overtime_records ot
      JOIN users u ON ot.user_id = u.id
      ORDER BY ot.record_date DESC, ot.created_at DESC
    `;
    const results = await this.executeRawQuery(query);
    return results.map(row => ({
      ...new OvertimeRecord(row).toJSON(),
      username: row.username,
    }));
  }

  async getTotalHoursByUser(userId, startDate, endDate) {
    const query = `
      SELECT SUM(total_hours) as total_hours
      FROM overtime_records 
      WHERE user_id = ? 
        AND record_date >= ? 
        AND record_date <= ?
        AND status = 'approved'
    `;
    const results = await this.executeRawQuery(query, [userId, startDate, endDate]);
    return results[0]?.total_hours || 0;
  }
}

module.exports = OvertimeRecordRepository;

