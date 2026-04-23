/**
 * Semantic versioning: MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH.REVISION (e.g. 1.2.3 or 1.2.3.0).
 * Canonical string form uses four numeric segments.
 */

/**
 * @param {string} versionString
 * @returns {{ major: number, minor: number, patch: number, revision: number }}
 */
function parseVersion(versionString) {
  if (!versionString || typeof versionString !== 'string') {
    throw new Error('Version string is required');
  }

  const parts = versionString.trim().split('.');
  if (parts.length !== 3 && parts.length !== 4) {
    throw new Error(
      `Invalid version format: ${versionString}. Expected MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH.REVISION (e.g. 1.2.3 or 1.0.0.0)`
    );
  }

  const nums = parts.map((p) => parseInt(p, 10));
  if (nums.some((n) => isNaN(n))) {
    throw new Error(`Invalid version format: ${versionString}. All parts must be numbers`);
  }
  if (nums.some((n) => n < 0)) {
    throw new Error(`Invalid version format: ${versionString}. Version numbers cannot be negative`);
  }

  const [major, minor, patch, revision = 0] = nums;
  return { major, minor, patch, revision };
}

/**
 * @param {{ major: number, minor: number, patch: number, revision?: number }} version
 * @returns {string}
 */
function formatVersion(version) {
  if (
    !version ||
    typeof version.major !== 'number' ||
    typeof version.minor !== 'number' ||
    typeof version.patch !== 'number'
  ) {
    throw new Error('Invalid version object. Must have major, minor, and patch properties');
  }
  const revision = typeof version.revision === 'number' ? version.revision : 0;
  return `${version.major}.${version.minor}.${version.patch}.${revision}`;
}

/**
 * @param {string} versionString
 * @returns {string}
 */
function normalizeVersion(versionString) {
  return formatVersion(parseVersion(versionString));
}

/**
 * @param {string} currentVersion
 * @param {'major'|'minor'|'patch'} incrementType
 * @returns {string}
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
    version.revision = 0;
  } else if (incrementType === 'minor') {
    version.minor += 1;
    version.patch = 0;
    version.revision = 0;
  } else {
    version.patch += 1;
    version.revision = 0;
  }

  return formatVersion(version);
}

/**
 * @param {string} version1
 * @param {string} version2
 * @returns {number}
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
  if (v1.revision !== v2.revision) {
    return v1.revision > v2.revision ? 1 : -1;
  }
  return 0;
}

/**
 * @param {string} versionString
 * @returns {boolean}
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
  normalizeVersion,
  incrementVersion,
  compareVersions,
  isValidVersion,
};
