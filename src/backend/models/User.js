function parseProfileComplete(value) {
  if (value === false || value === 0 || value === '0') {
    return false;
  }
  if (value === true || value === 1 || value === '1') {
    return true;
  }
  return true;
}

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.firstName = data.first_name || data.firstName || null;
    this.lastName = data.last_name || data.lastName || null;
    this.email = data.email;
    this.officeLocation = data.office_location || data.officeLocation || null;
    this.passwordHash = data.password_hash || data.passwordHash;
    this.isAdmin = data.is_admin !== undefined ? Boolean(data.is_admin) : (data.isAdmin !== undefined ? Boolean(data.isAdmin) : false);
    this.role = data.role || 'user';
    this.resetToken = data.reset_token || data.resetToken || null;
    this.resetTokenExpiry = data.reset_token_expiry || data.resetTokenExpiry || null;
    this.invitationToken = data.invitation_token || data.invitationToken || null;
    this.invitationTokenExpiry = data.invitation_token_expiry || data.invitationTokenExpiry || null;
    this.profileComplete = parseProfileComplete(data.profile_complete ?? data.profileComplete);
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      officeLocation: this.officeLocation,
      isAdmin: this.isAdmin,
      role: this.role,
      profileComplete: this.profileComplete,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toJSONWithPassword() {
    return {
      id: this.id,
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      officeLocation: this.officeLocation,
      isAdmin: this.isAdmin,
      passwordHash: this.passwordHash,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    const data = {
      username: this.username,
      email: this.email,
      role: this.role,
    };

    if (this.passwordHash !== null && this.passwordHash !== undefined) {
      data.password_hash = this.passwordHash;
    } else {
      data.password_hash = null;
    }
    if (this.firstName !== null && this.firstName !== undefined) {
      data.first_name = this.firstName;
    }
    if (this.lastName !== null && this.lastName !== undefined) {
      data.last_name = this.lastName;
    }
    if (this.officeLocation !== null && this.officeLocation !== undefined) {
      data.office_location = this.officeLocation;
    }
    if (this.isAdmin !== null && this.isAdmin !== undefined) {
      data.is_admin = this.isAdmin;
    }
    if (this.resetToken !== null && this.resetToken !== undefined) {
      data.reset_token = this.resetToken;
    }
    if (this.resetTokenExpiry !== null && this.resetTokenExpiry !== undefined) {
      data.reset_token_expiry = this.resetTokenExpiry;
    }
    if (this.invitationToken !== null && this.invitationToken !== undefined) {
      data.invitation_token = this.invitationToken;
    }
    if (this.invitationTokenExpiry !== null && this.invitationTokenExpiry !== undefined) {
      data.invitation_token_expiry = this.invitationTokenExpiry;
    }
    if (this.profileComplete !== null && this.profileComplete !== undefined) {
      data.profile_complete = this.profileComplete;
    }

    return data;
  }

  /**
   * Get display name (first name + last name, or email if names not available)
   * @returns {string} Display name
   */
  getDisplayName() {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`;
    }
    if (this.firstName) {
      return this.firstName;
    }
    if (this.email) {
      return this.email;
    }
    return this.username;
  }
}

module.exports = User;

