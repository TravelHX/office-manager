class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.role = data.role || 'user';
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toJSONWithPassword() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      username: this.username,
      email: this.email,
      password_hash: this.passwordHash,
      role: this.role,
    };
  }
}

module.exports = User;

