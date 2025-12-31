class ParkingReservation {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.parkingSpaceId = data.parking_space_id;
    this.reservationDate = data.reservation_date;
    this.timePeriod = data.time_period || 'full_day';
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
      parkingSpaceId: this.parkingSpaceId,
      reservationDate: this.reservationDate,
      timePeriod: this.timePeriod,
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
      parking_space_id: this.parkingSpaceId,
      reservation_date: this.reservationDate,
      time_period: this.timePeriod,
      status: this.status,
      cancelled_at: this.cancelledAt,
      cancelled_by: this.cancelledBy,
      cancellation_reason: this.cancellationReason,
    };
  }
}

module.exports = ParkingReservation;

