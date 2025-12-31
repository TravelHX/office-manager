class Booking {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.deskId = data.desk_id;
    this.startDate = data.start_date;
    this.endDate = data.end_date;
    this.status = data.status || 'active';
    this.cancelledAt = data.cancelled_at;
    this.cancelledBy = data.cancelled_by;
    this.cancellationReason = data.cancellation_reason;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      deskId: this.deskId,
      startDate: this.startDate,
      endDate: this.endDate,
      status: this.status,
      cancelledAt: this.cancelledAt,
      cancelledBy: this.cancelledBy,
      cancellationReason: this.cancellationReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      user_id: this.userId,
      desk_id: this.deskId,
      start_date: this.startDate,
      end_date: this.endDate,
      status: this.status,
      cancelled_at: this.cancelledAt,
      cancelled_by: this.cancelledBy,
      cancellation_reason: this.cancellationReason,
    };
  }
}

module.exports = Booking;

