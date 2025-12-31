const BaseRepository = require('../data-access/base-repository');
const Desk = require('../models/Desk');

class DeskRepository extends BaseRepository {
  constructor() {
    super('desks');
  }

  async findAllActive() {
    const query = 'SELECT * FROM desks WHERE is_active = 1 ORDER BY desk_number';
    const results = await this.executeRawQuery(query);
    return results.map(row => new Desk(row));
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new Desk(result) : null;
  }

  async findByDeskNumber(deskNumber) {
    const query = 'SELECT * FROM desks WHERE desk_number = ?';
    const results = await this.executeRawQuery(query, [deskNumber]);
    return results.length > 0 ? new Desk(results[0]) : null;
  }

  async create(desk) {
    const data = desk instanceof Desk ? desk.toDatabaseFormat() : desk;
    const id = await super.create(data);
    return this.findById(id);
  }

  async update(id, desk) {
    const data = desk instanceof Desk ? desk.toDatabaseFormat() : desk;
    await super.update(id, data);
    return this.findById(id);
  }

  async findAll() {
    const results = await super.findAll();
    return results.map(row => new Desk(row));
  }
}

module.exports = DeskRepository;

