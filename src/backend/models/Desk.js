class Desk {
  constructor(data) {
    this.id = data.id;
    this.deskNumber = data.desk_number;
    this.location = data.location;
    this.description = data.description;
    this.isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      deskNumber: this.deskNumber,
      location: this.location,
      description: this.description,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      desk_number: this.deskNumber,
      location: this.location,
      description: this.description,
      is_active: this.isActive ? 1 : 0,
    };
  }
}

module.exports = Desk;

