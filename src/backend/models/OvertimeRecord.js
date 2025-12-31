class OvertimeRecord {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.recordDate = data.record_date;
    this.startTime = data.start_time;
    this.endTime = data.end_time;
    this.totalHours = data.total_hours;
    this.description = data.description;
    this.status = data.status || 'pending';
    this.approvedBy = data.approved_by;
    this.approvedAt = data.approved_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      recordDate: this.recordDate,
      startTime: this.startTime,
      endTime: this.endTime,
      totalHours: parseFloat(this.totalHours),
      description: this.description,
      status: this.status,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      user_id: this.userId,
      record_date: this.recordDate,
      start_time: this.startTime,
      end_time: this.endTime,
      total_hours: this.totalHours,
      description: this.description,
      status: this.status,
      approved_by: this.approvedBy,
      approved_at: this.approvedAt,
    };
  }
}

module.exports = OvertimeRecord;

