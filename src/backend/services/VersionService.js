const VersionRepository = require('../repositories/VersionRepository');
const Version = require('../models/Version');
const { parseVersion, incrementVersion, isValidVersion } = require('../utils/semantic-version');
const fs = require('fs');
const path = require('path');

class VersionService {
  constructor() {
    this.versionRepository = new VersionRepository();
  }

  /**
   * Get current version from database
   * @returns {Promise<Version>} Current version
   */
  async getCurrentVersion() {
    const version = await this.versionRepository.getCurrent();
    if (!version) {
      // Return default version if none exists
      return new Version({
        version_number: '0.1.0',
        deployment_info: null,
      });
    }
    return version;
  }

  /**
   * Update version in database
   * @param {string} versionNumber - New version number
   * @param {string} deploymentInfo - Optional deployment information
   * @returns {Promise<Version>} Updated version
   */
  async updateVersion(versionNumber, deploymentInfo = null) {
    if (!isValidVersion(versionNumber)) {
      throw new Error(`Invalid version format: ${versionNumber}. Expected format: MAJOR.MINOR.PATCH (e.g., 1.2.3)`);
    }

    return await this.versionRepository.updateCurrentVersion(versionNumber, deploymentInfo);
  }

  /**
   * Increment version and update in database
   * @param {string} incrementType - Type of increment: 'major', 'minor', or 'patch' (default: 'patch')
   * @param {string} deploymentInfo - Optional deployment information
   * @returns {Promise<Version>} Updated version
   */
  async incrementAndUpdateVersion(incrementType = 'patch', deploymentInfo = null) {
    const current = await this.getCurrentVersion();
    const newVersion = incrementVersion(current.versionNumber, incrementType);
    return await this.updateVersion(newVersion, deploymentInfo);
  }

  /**
   * Read version from package.json or version file
   * @returns {Promise<string>} Version string
   */
  async readVersionFromFile() {
    // Try to read from package.json first
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.version) {
          return packageJson.version;
        }
      } catch (error) {
        // Ignore errors reading package.json
      }
    }

    // Try to read from version.txt file
    const versionFilePath = path.resolve(__dirname, '../../../version.txt');
    if (fs.existsSync(versionFilePath)) {
      try {
        const version = fs.readFileSync(versionFilePath, 'utf8').trim();
        if (isValidVersion(version)) {
          return version;
        }
      } catch (error) {
        // Ignore errors reading version.txt
      }
    }

    // Return default version
    return '0.1.0';
  }

  /**
   * Write version to file (package.json or version.txt)
   * @param {string} versionNumber - Version to write
   * @returns {Promise<void>}
   */
  async writeVersionToFile(versionNumber) {
    if (!isValidVersion(versionNumber)) {
      throw new Error(`Invalid version format: ${versionNumber}`);
    }

    // Try to write to package.json first
    const packageJsonPath = path.resolve(__dirname, '../../../package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packageJson.version = versionNumber;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
        return;
      } catch (error) {
        // Fall back to version.txt if package.json write fails
      }
    }

    // Write to version.txt
    const versionFilePath = path.resolve(__dirname, '../../../version.txt');
    fs.writeFileSync(versionFilePath, versionNumber + '\n', 'utf8');
  }

  /**
   * Initialize version on application startup
   * Reads version from file, updates database, and logs version
   * @returns {Promise<Version>} Current version
   */
  async initializeVersionOnStartup() {
    const logger = require('../utils/logger');
    
    try {
      // Read version from file
      const fileVersion = await this.readVersionFromFile();
      
      // Get current version from database
      const dbVersion = await this.getCurrentVersion();
      
      // If file version is different from database version, update database
      if (fileVersion !== dbVersion.versionNumber) {
        logger.info(`Version mismatch detected. File: ${fileVersion}, Database: ${dbVersion.versionNumber}. Updating database...`);
        await this.updateVersion(fileVersion, `Updated on startup: ${new Date().toISOString()}`);
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
      // Don't throw - allow application to start even if version update fails
      // But log the error prominently
      logger.error('========================================');
      logger.error('WARNING: Version tracking initialization failed');
      logger.error('The application will continue to run, but version tracking may be inaccurate.');
      logger.error('========================================');
      
      // Return default version
      return new Version({
        version_number: '0.1.0',
        deployment_info: 'Version initialization failed',
      });
    }
  }
}

module.exports = VersionService;
