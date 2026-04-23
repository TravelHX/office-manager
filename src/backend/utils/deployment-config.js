const fs = require('fs');
const path = require('path');
const { isValidVersion, normalizeVersion } = require('./semantic-version');

const DEFAULT_DEPLOYMENT_VERSION = '1.0.0.0';

function getConfigPath() {
  return path.resolve(__dirname, '../../../data/config.json');
}

/**
 * Read deployment semantic version from data/config.json (deployment_info.version).
 * @returns {string} Normalized MAJOR.MINOR.PATCH.REVISION (default 1.0.0.0)
 */
function readDeploymentVersion() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return DEFAULT_DEPLOYMENT_VERSION;
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const v = config.deployment_info && config.deployment_info.version;
    if (typeof v === 'string' && isValidVersion(v.trim())) {
      return normalizeVersion(v.trim());
    }
  } catch {
    // ignore parse/read errors
  }
  return DEFAULT_DEPLOYMENT_VERSION;
}

/**
 * Persist deployment version into data/config.json under deployment_info.version.
 * @param {string} versionString - Valid semantic version (3 or 4 parts; stored normalized)
 */
function writeDeploymentVersion(versionString) {
  if (!isValidVersion(versionString)) {
    throw new Error(`Invalid version format: ${versionString}`);
  }
  const normalized = normalizeVersion(versionString);
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error(`config.json not found at ${configPath}`);
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  config.deployment_info = Object.assign({}, config.deployment_info, { version: normalized });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return normalized;
}

module.exports = {
  getConfigPath,
  readDeploymentVersion,
  writeDeploymentVersion,
  DEFAULT_DEPLOYMENT_VERSION,
};
