const BaseRepository = require('../data-access/base-repository');
const ParkingSpace = require('../models/ParkingSpace');
const naturalSort = require('../utils/natural-sort');

class ParkingSpaceRepository extends BaseRepository {
  constructor() {
    super('parking_spaces');
  }

  async findAllActive() {
    // Phase 24: in-JS natural sort matches the desk repository pattern.
    const query = 'SELECT * FROM parking_spaces WHERE is_active = 1';
    const results = await this.executeRawQuery(query);
    const spaces = results.map(row => new ParkingSpace(row));
    return naturalSort.sortByProperty(spaces, 'spaceNumber');
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
    return naturalSort.sortByProperty(
      results.map(row => new ParkingSpace(row)),
      'spaceNumber'
    );
  }
}

module.exports = ParkingSpaceRepository;

