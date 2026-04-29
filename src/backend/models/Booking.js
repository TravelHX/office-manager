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
    // Phase 27a: optional Key Fob request flag stored against the
    // booking. The DB column is `fob_requested TINYINT(1)` so values
    // round-trip as 0/1; the model exposes a strict boolean. When the
    // input lacks the column entirely (e.g. fixtures from older tests),
    // we default to false rather than undefined so consumers can rely
    // on the field always being present in toJSON().
    this.fobRequested = Boolean(data.fob_requested);
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
      fobRequested: this.fobRequested,
    };
  }

  toDatabaseFormat() {
    const data = {
      user_id: this.userId,
      desk_id: this.deskId,
      start_date: this.startDate,
      end_date: this.endDate,
      status: this.status,
      // Always serialise as 0/1 so the column never receives JS booleans
      // (which the mysql2 driver would coerce, but we'd rather be
      // explicit and consistent with the existing schema convention).
      fob_requested: this.fobRequested ? 1 : 0,
    };

    // Only include optional fields if they have values
    if (this.cancelledAt) {
      data.cancelled_at = this.cancelledAt;
    }
    if (this.cancelledBy) {
      data.cancelled_by = this.cancelledBy;
    }
    if (this.cancellationReason) {
      data.cancellation_reason = this.cancellationReason;
    }

    return data;
  }
}

module.exports = Booking;

