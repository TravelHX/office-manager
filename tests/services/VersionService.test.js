const VersionService = require('../../src/backend/services/VersionService');
const VersionRepository = require('../../src/backend/repositories/VersionRepository');
const Version = require('../../src/backend/models/Version');

jest.mock('../../src/backend/repositories/VersionRepository');
jest.mock('../../src/backend/utils/deployment-config', () => ({
  readDeploymentVersion: jest.fn(() => '1.2.3.0'),
  writeDeploymentVersion: jest.fn(),
  DEFAULT_DEPLOYMENT_VERSION: '1.0.0.0',
}));

const deploymentConfig = require('../../src/backend/utils/deployment-config');

describe('VersionService', () => {
  let versionService;
  let mockVersionRepository;

  beforeEach(() => {
    deploymentConfig.readDeploymentVersion.mockReturnValue('1.2.3.0');
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
    test('should return version from config merged with database metadata', async () => {
      const mockVersion = new Version({
        id: 1,
        version_number: '9.9.9.9',
        deployment_info: 'Test deployment',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(mockVersion);

      const result = await versionService.getCurrentVersion();

      expect(result.versionNumber).toBe('1.2.3.0');
      expect(result.deploymentInfo).toBe('Test deployment');
      expect(result.id).toBe(1);
      expect(mockVersionRepository.getCurrent).toHaveBeenCalled();
    });

    test('should return config version when database has no row', async () => {
      deploymentConfig.readDeploymentVersion.mockReturnValue('1.0.0.0');
      mockVersionRepository.getCurrent.mockResolvedValue(null);

      const result = await versionService.getCurrentVersion();

      expect(result.versionNumber).toBe('1.0.0.0');
      expect(result.deploymentInfo).toBeNull();
    });
  });

  describe('updateVersion', () => {
    test('should update version successfully', async () => {
      const mockVersion = new Version({
        id: 1,
        version_number: '1.2.4.0',
        deployment_info: 'Updated',
      });

      mockVersionRepository.updateCurrentVersion.mockResolvedValue(mockVersion);

      const result = await versionService.updateVersion('1.2.4', 'Updated');

      expect(result).toEqual(mockVersion);
      expect(deploymentConfig.writeDeploymentVersion).toHaveBeenCalledWith('1.2.4.0');
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('1.2.4.0', 'Updated');
    });

    test('should throw error for invalid version format', async () => {
      await expect(versionService.updateVersion('invalid')).rejects.toThrow('Invalid version format');
      expect(mockVersionRepository.updateCurrentVersion).not.toHaveBeenCalled();
      expect(deploymentConfig.writeDeploymentVersion).not.toHaveBeenCalled();
    });
  });

  describe('incrementAndUpdateVersion', () => {
    test('should increment patch version by default', async () => {
      deploymentConfig.readDeploymentVersion.mockReturnValue('1.2.3.0');
      const updatedVersion = new Version({
        id: 1,
        version_number: '1.2.4.0',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(
        new Version({ id: 1, version_number: '1.2.3.0' })
      );
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.incrementAndUpdateVersion();

      expect(result.versionNumber).toBe('1.2.4.0');
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('1.2.4.0', null);
    });

    test('should increment minor version', async () => {
      deploymentConfig.readDeploymentVersion.mockReturnValue('1.2.3.0');
      const updatedVersion = new Version({
        id: 1,
        version_number: '1.3.0.0',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(
        new Version({ id: 1, version_number: '1.2.3.0' })
      );
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.incrementAndUpdateVersion('minor');

      expect(result.versionNumber).toBe('1.3.0.0');
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('1.3.0.0', null);
    });

    test('should increment major version', async () => {
      deploymentConfig.readDeploymentVersion.mockReturnValue('1.2.3.0');
      const updatedVersion = new Version({
        id: 1,
        version_number: '2.0.0.0',
      });

      mockVersionRepository.getCurrent.mockResolvedValue(
        new Version({ id: 1, version_number: '1.2.3.0' })
      );
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.incrementAndUpdateVersion('major');

      expect(result.versionNumber).toBe('2.0.0.0');
      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalledWith('2.0.0.0', null);
    });
  });

  describe('readVersionFromFile', () => {
    test('should return deployment version from config reader', async () => {
      deploymentConfig.readDeploymentVersion.mockReturnValue('4.5.6.0');
      const version = await versionService.readVersionFromFile();
      expect(version).toBe('4.5.6.0');
    });
  });

  describe('writeVersionToFile', () => {
    test('should write normalized version via deployment config', async () => {
      await versionService.writeVersionToFile('1.2.4');
      expect(deploymentConfig.writeDeploymentVersion).toHaveBeenCalledWith('1.2.4.0');
    });

    test('should throw error for invalid version format', async () => {
      await expect(versionService.writeVersionToFile('invalid')).rejects.toThrow('Invalid version format');
    });
  });

  describe('initializeVersionOnStartup', () => {
    test('should update database if config version differs from database', async () => {
      const dbVersion = new Version({
        id: 1,
        version_number: '1.2.3.0',
      });
      const updatedVersion = new Version({
        id: 1,
        version_number: '1.2.4.0',
      });

      deploymentConfig.readDeploymentVersion.mockReturnValue('1.2.4.0');
      mockVersionRepository.getCurrent.mockResolvedValue(dbVersion);
      mockVersionRepository.updateCurrentVersion.mockResolvedValue(updatedVersion);

      const result = await versionService.initializeVersionOnStartup();

      expect(mockVersionRepository.updateCurrentVersion).toHaveBeenCalled();
      expect(result.versionNumber).toBe('1.2.4.0');
    });

    test('should not update database if versions match', async () => {
      const dbVersion = new Version({
        id: 1,
        version_number: '1.2.3.0',
      });

      deploymentConfig.readDeploymentVersion.mockReturnValue('1.2.3.0');
      mockVersionRepository.getCurrent.mockResolvedValue(dbVersion);

      const result = await versionService.initializeVersionOnStartup();

      expect(mockVersionRepository.updateCurrentVersion).not.toHaveBeenCalled();
      expect(result.versionNumber).toBe('1.2.3.0');
    });

    test('should handle errors gracefully and return default version', async () => {
      deploymentConfig.readDeploymentVersion.mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await versionService.initializeVersionOnStartup();

      expect(result.versionNumber).toBe('1.0.0.0');
      expect(result.deploymentInfo).toContain('failed');
    });
  });
});
