const VersionService = require('../../src/backend/services/VersionService');
const VersionRepository = require('../../src/backend/repositories/VersionRepository');
const Version = require('../../src/backend/models/Version');
const fs = require('fs');
const path = require('path');

jest.mock('../../src/backend/repositories/VersionRepository');
jest.mock('fs');

describe('VersionService', () => {
  let versionService;
  let mockVersionRepository;

  beforeEach(() => {
    mockVersionRepository = {
      getCurrent: jest.fn(),
      updateCurrentVersion: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    VersionRepository.mockImplementation(() => mockVersionRepository);
    versionService = new VersionService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentVersion', () => {
    test('should return current version from database', async () => {
      const mockVersion = new Version({
        id: 1,
        version_number: '1.2.3',
        deployment_info: 'Test deployment',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(mockVersion);

      const result = await versionService.getCurrentVersion();

      expect(result).toEqual(mockVersion);
      expect(mockVersionRepository.getCurrent).toHaveBeenCalled();
    });

    test('should return default version if none exists', async () => {
      mockVersionRepository.getCurrent.mockResolvedValue(null);

      const result = await versionService.getCurrentVersion();

      expect(result.versionNumber).toBe('0.1.0');
      expect(result.deploymentInfo).toBeNull();
    });
  });

  describe('updateVersion', () => {
    test('should update version successfully', async () => {
      const mockVersion = new Version({
        id: 1,
        version_number: '1.2.4',
        deployment_info: 'Updated',
      });

      mockVersionRepository.updateCurrentVersion.mockResolvedValue(mockVersion);

      const result = await versionService.updateVersion('1.2.4', 'Updated');

      expect(result).toEqual(mockVersion);
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('1.2.4', 'Updated');
    });

    test('should throw error for invalid version format', async () => {
      await expect(versionService.updateVersion('invalid')).rejects.toThrow('Invalid version format');
      expect(mockVersionRepository.updateCurrentVersion).not.toHaveBeenCalled();
    });
  });

  describe('incrementAndUpdateVersion', () => {
    test('should increment patch version by default', async () => {
      const currentVersion = new Version({
        id: 1,
        version_number: '1.2.3',
      });
      const updatedVersion = new Version({
        id: 1,
        version_number: '1.2.4',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(currentVersion);
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.incrementAndUpdateVersion();

      expect(result.versionNumber).toBe('1.2.4');
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('1.2.4', null);
    });

    test('should increment minor version', async () => {
      const currentVersion = new Version({
        id: 1,
        version_number: '1.2.3',
      });
      const updatedVersion = new Version({
        id: 1,
        version_number: '1.3.0',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(currentVersion);
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.incrementAndUpdateVersion('minor');

      expect(result.versionNumber).toBe('1.3.0');
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('1.3.0', null);
    });

    test('should increment major version', async () => {
      const currentVersion = new Version({
        id: 1,
        version_number: '1.2.3',
      });
      const updatedVersion = new Version({
        id: 1,
        version_number: '2.0.0',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(currentVersion);
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.incrementAndUpdateVersion('major');

      expect(result.versionNumber).toBe('2.0.0');
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('2.0.0', null);
    });
  });

  describe('readVersionFromFile', () => {
    test('should read version from package.json', async () => {
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');
      const mockPackageJson = { version: '1.2.3' };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      const version = await versionService.readVersionFromFile();

      expect(version).toBe('1.2.3');
    });

    test('should read version from version.txt if package.json not found', async () => {
      const versionFilePath = path.resolve(__dirname, '../../../version.txt');

      fs.existsSync.mockImplementation((filePath) => {
        if (filePath.includes('package.json')) return false;
        if (filePath.includes('version.txt')) return true;
        return false;
      });
      fs.readFileSync.mockReturnValue('1.2.3\n');

      const version = await versionService.readVersionFromFile();

      expect(version).toBe('1.2.3');
    });

    test('should return default version if no file found', async () => {
      fs.existsSync.mockReturnValue(false);

      const version = await versionService.readVersionFromFile();

      expect(version).toBe('0.1.0');
    });
  });

  describe('writeVersionToFile', () => {
    test('should write version to package.json', async () => {
      const packageJsonPath = path.resolve(__dirname, '../../../package.json');
      const mockPackageJson = { version: '1.2.3', name: 'test' };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockPackageJson));

      await versionService.writeVersionToFile('1.2.4');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = fs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toBe(packageJsonPath);
      const writtenJson = JSON.parse(writeCall[1]);
      expect(writtenJson.version).toBe('1.2.4');
    });

    test('should write version to version.txt if package.json not found', async () => {
      const versionFilePath = path.resolve(__dirname, '../../../version.txt');

      fs.existsSync.mockReturnValue(false);

      await versionService.writeVersionToFile('1.2.4');

      expect(fs.writeFileSync).toHaveBeenCalledWith(versionFilePath, '1.2.4\n', 'utf8');
    });

    test('should throw error for invalid version format', async () => {
      await expect(versionService.writeVersionToFile('invalid')).rejects.toThrow('Invalid version format');
    });
  });

  describe('initializeVersionOnStartup', () => {
    test('should update database if file version differs', async () => {
      const dbVersion = new Version({
        id: 1,
        version_number: '1.2.3',
      });
      const updatedVersion = new Version({
        id: 1,
        version_number: '1.2.4',
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('1.2.4');
      mockVersionRepository.getCurrent.mockResolvedValue(dbVersion);
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.initializeVersionOnStartup();

      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalled();
      expect(result.versionNumber).toBe('1.2.4');
    });

    test('should not update database if versions match', async () => {
      const dbVersion = new Version({
        id: 1,
        version_number: '1.2.3',
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('1.2.3');
      mockVersionRepository.getCurrent.mockResolvedValue(dbVersion);

      const result = await versionService.initializeVersionOnStartup();

      expect(mockVersionRepository.updateCurrentVersion).not.toHaveBeenCalled();
      expect(result.versionNumber).toBe('1.2.3');
    });

    test('should handle errors gracefully and return default version', async () => {
      fs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await versionService.initializeVersionOnStartup();

      expect(result.versionNumber).toBe('0.1.0');
      expect(result.deploymentInfo).toContain('failed');
    });
  });
});
