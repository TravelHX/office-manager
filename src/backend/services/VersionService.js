const VersionRepository = require('../repositories/VersionRepository');
const Version = require('../models/Version');
const { incrementVersion, isValidVersion, normalizeVersion } = require('../utils/semantic-version');
const { readDeploymentVersion, writeDeploymentVersion, DEFAULT_DEPLOYMENT_VERSION } = require('../utils/deployment-config');

class VersionService {
  constructor() {
    this.versionRepository = new VersionRepository();
  }

  /**
   * Current displayed version is read from data/config.json (deployment_info.version).
   * Database row supplies metadata (deployment_info text, timestamps) when present.
   * @returns {Promise<Version>}
   */
  async getCurrentVersion() {
    const configVersion = readDeploymentVersion();
    const dbVersion = await this.versionRepository.getCurrent();
    return new Version({
      id: dbVersion ? dbVersion.id : undefined,
      version_number: configVersion,
      deployment_info: dbVersion ? dbVersion.deploymentInfo : null,
      created_at: dbVersion ? dbVersion.createdAt : undefined,
      updated_at: dbVersion ? dbVersion.updatedAt : undefined,
    });
  }

  /**
   * @param {string} versionNumber
   * @param {string|null} deploymentInfo
   * @returns {Promise<Version>}
   */
  async updateVersion(versionNumber, deploymentInfo = null) {
    if (!isValidVersion(versionNumber)) {
      throw new Error(
        `Invalid version format: ${versionNumber}. Expected MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH.REVISION (e.g. 1.2.3 or 1.0.0.0)`
      );
    }

    const normalized = normalizeVersion(versionNumber);
    writeDeploymentVersion(normalized);
    return await this.versionRepository.updateCurrentVersion(normalized, deploymentInfo);
  }

  /**
   * @param {string} incrementType
   * @param {string|null} deploymentInfo
   * @returns {Promise<Version>}
   */
  async incrementAndUpdateVersion(incrementType = 'patch', deploymentInfo = null) {
    const current = await this.getCurrentVersion();
    const newVersion = incrementVersion(current.versionNumber, incrementType);
    return await this.updateVersion(newVersion, deploymentInfo);
  }

  /**
   * Authoritative version for startup sync (from config).
   * @returns {Promise<string>}
   */
  async readVersionFromFile() {
    return readDeploymentVersion();
  }

  /**
   * @param {string} versionNumber
   * @returns {Promise<void>}
   */
  async writeVersionToFile(versionNumber) {
    if (!isValidVersion(versionNumber)) {
      throw new Error(`Invalid version format: ${versionNumber}`);
    }
    writeDeploymentVersion(normalizeVersion(versionNumber));
  }

  /**
   * @returns {Promise<Version>}
   */
  async initializeVersionOnStartup() {
    const logger = require('../utils/logger');

    try {
      const fileVersion = await this.readVersionFromFile();
      const dbVersion = await this.versionRepository.getCurrent();
      const dbNum = dbVersion ? dbVersion.versionNumber : null;

      if (fileVersion !== dbNum) {
        logger.info(
          `Version mismatch detected. Config: ${fileVersion}, Database: ${dbNum ?? '(none)'}. Updating database...`
        );
        await this.versionRepository.updateCurrentVersion(fileVersion, `Updated on startup: ${new Date().toISOString()}`);
        logger.info(`Version updated in database to: ${fileVersion}`);
      } else {
        logger.info(`Application version: ${fileVersion}`);
      }

      const currentVersion = await this.getCurrentVersion();
      logger.info(`Current application version: ${currentVersion.versionNumber}`);

      return currentVersion;
    } catch (error) {
      logger.error('Failed to initialize version on startup:', error.message);
      logger.error('Stack trace:', error.stack);
      logger.error('========================================');
      logger.error('WARNING: Version tracking initialization failed');
      logger.error('The application will continue to run, but version tracking may be inaccurate.');
      logger.error('========================================');

      return new Version({
        version_number: DEFAULT_DEPLOYMENT_VERSION,
        deployment_info: 'Version initialization failed',
      });
    }
  }
}

module.exports = VersionService;
