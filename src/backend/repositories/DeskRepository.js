const BaseRepository = require('../data-access/base-repository');
const Desk = require('../models/Desk');
const naturalSort = require('../utils/natural-sort');

class DeskRepository extends BaseRepository {
  constructor() {
    super('desks');
  }

  async findAllActive() {
    // Phase 24: SQL ORDER BY desk_number sorts strings ("10" before "2"),
    // so we sort in JS using the natural comparator. The list is small
    // (<= a few hundred) and only fetched on admin / availability paths.
    const query = 'SELECT * FROM desks WHERE is_active = 1';
    const results = await this.executeRawQuery(query);
    const desks = results.map(row => new Desk(row));
    return naturalSort.sortByProperty(desks, 'deskNumber');
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
    return naturalSort.sortByProperty(
      results.map(row => new Desk(row)),
      'deskNumber'
    );
  }
}

module.exports = DeskRepository;

