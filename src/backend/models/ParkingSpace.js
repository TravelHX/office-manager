class ParkingSpace {
  constructor(data) {
    this.id = data.id;
    this.spaceNumber = data.space_number;
    this.location = data.location;
    this.description = data.description;
    this.isActive = data.is_active !== undefined ? Boolean(data.is_active) : true;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      spaceNumber: this.spaceNumber,
      location: this.location,
      description: this.description,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      space_number: this.spaceNumber,
      location: this.location,
      description: this.description,
      is_active: this.isActive ? 1 : 0,
    };
  }
}

module.exports = ParkingSpace;

