const BaseRepository = require('../data-access/base-repository');
const ParkingSpace = require('../models/ParkingSpace');

class ParkingSpaceRepository extends BaseRepository {
  constructor() {
    super('parking_spaces');
  }

  async findAllActive() {
    const query = 'SELECT * FROM parking_spaces WHERE is_active = 1 ORDER BY space_number';
    const results = await this.executeRawQuery(query);
    return results.map(row => new ParkingSpace(row));
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new ParkingSpace(result) : null;
  }

  async findBySpaceNumber(spaceNumber) {
    const query = 'SELECT * FROM parking_spaces WHERE space_number = ?';
    const results = await this.executeRawQuery(query, [spaceNumber]);
    return results.length > 0 ? new ParkingSpace(results[0]) : null;
  }

  async create(parkingSpace) {
    const data = parkingSpace instanceof ParkingSpace ? parkingSpace.toDatabaseFormat() : parkingSpace;
    const id = await super.create(data);
    return this.findById(id);
  }

  async update(id, parkingSpace) {
    const data = parkingSpace instanceof ParkingSpace ? parkingSpace.toDatabaseFormat() : parkingSpace;
    await super.update(id, data);
    return this.findById(id);
  }

  async findAll() {
    const results = await super.findAll();
    return results.map(row => new ParkingSpace(row));
  }
}

module.exports = ParkingSpaceRepository;

