const OvertimeRecordRepository = require('../repositories/OvertimeRecordRepository');
const OvertimeRecord = require('../models/OvertimeRecord');

class OvertimeService {
  constructor() {
    this.overtimeRecordRepository = new OvertimeRecordRepository();
  }

  calculateTotalHours(startTime, endTime) {
    const start = this.parseTime(startTime);
    const end = this.parseTime(endTime);

    if (!start || !end) {
      throw new Error('Invalid time format. Use HH:MM:SS or HH:MM');
    }

    if (end <= start) {
      throw new Error('End time must be after start time');
    }

    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.round(diffHours * 100) / 100;
  }

  parseTime(timeString) {
    if (!timeString) return null;
    
    const parts = timeString.split(':');
    if (parts.length < 2) return null;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
      return null;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      return null;
    }

    const date = new Date();
    date.setHours(hours, minutes, seconds, 0);
    return date;
  }

  async createOvertimeRecord(userId, recordDate, startTime, endTime, description = null) {
    if (!recordDate || !startTime || !endTime) {
      throw new Error('Record date, start time, and end time are required');
    }

    const date = new Date(recordDate);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const recordDateObj = new Date(recordDate);
    recordDateObj.setHours(0, 0, 0, 0);

    if (recordDateObj > today) {
      throw new Error('Cannot record overtime for future dates');
    }

    const totalHours = this.calculateTotalHours(startTime, endTime);

    if (totalHours <= 0) {
      throw new Error('Overtime hours must be greater than zero');
    }

    if (totalHours > 24) {
      throw new Error('Overtime hours cannot exceed 24 hours per day');
    }

    const overtimeRecord = new OvertimeRecord({
      user_id: userId,
      record_date: recordDate,
      start_time: startTime,
      end_time: endTime,
      total_hours: totalHours,
      description: description,
      status: 'pending',
    });

    return await this.overtimeRecordRepository.create(overtimeRecord);
  }

  async getOvertimeRecordById(id) {
    const record = await this.overtimeRecordRepository.findById(id);
    if (!record) {
      throw new Error('Overtime record not found');
    }
    return record;
  }

  async getUserOvertimeRecords(userId) {
    return await this.overtimeRecordRepository.findByUserId(userId);
  }

  async getUserOvertimeRecordsByDateRange(userId, startDate, endDate) {
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    return await this.overtimeRecordRepository.findByUserIdAndDateRange(userId, startDate, endDate);
  }

  async updateOvertimeRecord(id, userId, recordDate, startTime, endTime, description = null) {
    const record = await this.overtimeRecordRepository.findById(id);
    if (!record) {
      throw new Error('Overtime record not found');
    }

    if (record.userId !== userId) {
      throw new Error('You can only update your own overtime records');
    }

    if (record.status === 'approved') {
      throw new Error('Cannot update approved overtime records');
    }

    const date = new Date(recordDate);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }

    const totalHours = this.calculateTotalHours(startTime, endTime);

    if (totalHours <= 0) {
      throw new Error('Overtime hours must be greater than zero');
    }

    if (totalHours > 24) {
      throw new Error('Overtime hours cannot exceed 24 hours per day');
    }

    const updatedRecord = new OvertimeRecord({
      ...record.toJSON(),
      record_date: recordDate,
      start_time: startTime,
      end_time: endTime,
      total_hours: totalHours,
      description: description,
    });

    return await this.overtimeRecordRepository.update(id, updatedRecord);
  }

  async deleteOvertimeRecord(id, userId) {
    const record = await this.overtimeRecordRepository.findById(id);
    if (!record) {
      throw new Error('Overtime record not found');
    }

    if (record.userId !== userId) {
      throw new Error('You can only delete your own overtime records');
    }

    if (record.status === 'approved') {
      throw new Error('Cannot delete approved overtime records');
    }

    await this.overtimeRecordRepository.delete(id);
    return true;
  }

  async getAllOvertimeRecords() {
    return await this.overtimeRecordRepository.findAll();
  }

  async getOvertimeRecordsByStatus(status) {
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new Error('Invalid status. Must be pending, approved, or rejected');
    }
    return await this.overtimeRecordRepository.findByStatus(status);
  }

  async approveOvertimeRecord(id, approvedBy) {
    const record = await this.overtimeRecordRepository.findById(id);
    if (!record) {
      throw new Error('Overtime record not found');
    }

    if (record.status === 'approved') {
      throw new Error('Overtime record is already approved');
    }

    return await this.overtimeRecordRepository.approve(id, approvedBy);
  }

  async rejectOvertimeRecord(id, approvedBy) {
    const record = await this.overtimeRecordRepository.findById(id);
    if (!record) {
      throw new Error('Overtime record not found');
    }

    if (record.status === 'rejected') {
      throw new Error('Overtime record is already rejected');
    }

    return await this.overtimeRecordRepository.reject(id, approvedBy);
  }

  async getOvertimeReport(userId, startDate, endDate) {
    const records = await this.getUserOvertimeRecordsByDateRange(userId, startDate, endDate);
    const totalHours = await this.overtimeRecordRepository.getTotalHoursByUser(userId, startDate, endDate);

    return {
      userId,
      startDate,
      endDate,
      records: records.map(r => r.toJSON()),
      totalHours: parseFloat(totalHours),
      recordCount: records.length,
    };
  }
}

module.exports = OvertimeService;

