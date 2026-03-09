/**
 * Semantic Versioning Utilities
 * Supports MAJOR.MINOR.PATCH format (e.g., 1.2.3)
 */

/**
 * Parse a semantic version string
 * @param {string} versionString - Version string (e.g., "1.2.3")
 * @returns {Object} Parsed version object with major, minor, patch
 * @throws {Error} If version string is invalid
 */
function parseVersion(versionString) {
  if (!versionString || typeof versionString !== 'string') {
    throw new Error('Version string is required');
  }

  const parts = versionString.trim().split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${versionString}. Expected format: MAJOR.MINOR.PATCH (e.g., 1.2.3)`);
  }

  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  const patch = parseInt(parts[2], 10);

  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error(`Invalid version format: ${versionString}. All parts must be numbers`);
  }

  if (major < 0 || minor < 0 || patch < 0) {
    throw new Error(`Invalid version format: ${versionString}. Version numbers cannot be negative`);
  }

  return { major, minor, patch };
}

/**
 * Format version object to string
 * @param {Object} version - Version object with major, minor, patch
 * @returns {string} Version string (e.g., "1.2.3")
 */
function formatVersion(version) {
  if (!version || typeof version.major !== 'number' || typeof version.minor !== 'number' || typeof version.patch !== 'number') {
    throw new Error('Invalid version object. Must have major, minor, and patch properties');
  }
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Increment version based on type
 * @param {string} currentVersion - Current version string (e.g., "1.2.3")
 * @param {string} incrementType - Type of increment: 'major', 'minor', or 'patch'
 * @returns {string} New version string
 */
function incrementVersion(currentVersion, incrementType = 'patch') {
  const validTypes = ['major', 'minor', 'patch'];
  if (!validTypes.includes(incrementType)) {
    throw new Error(`Invalid increment type: ${incrementType}. Must be one of: ${validTypes.join(', ')}`);
  }

  const version = parseVersion(currentVersion);
  
  if (incrementType === 'major') {
    version.major += 1;
    version.minor = 0;
    version.patch = 0;
  } else if (incrementType === 'minor') {
    version.minor += 1;
    version.patch = 0;
  } else {
    version.patch += 1;
  }

  return formatVersion(version);
}

/**
 * Compare two versions
 * @param {string} version1 - First version string
 * @param {string} version2 - Second version string
 * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
function compareVersions(version1, version2) {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  if (v1.major !== v2.major) {
    return v1.major > v2.major ? 1 : -1;
  }
  if (v1.minor !== v2.minor) {
    return v1.minor > v2.minor ? 1 : -1;
  }
  if (v1.patch !== v2.patch) {
    return v1.patch > v2.patch ? 1 : -1;
  }
  return 0;
}

/**
 * Validate version string format
 * @param {string} versionString - Version string to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidVersion(versionString) {
  try {
    parseVersion(versionString);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  parseVersion,
  formatVersion,
  incrementVersion,
  compareVersions,
  isValidVersion,
};
