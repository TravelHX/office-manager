jest.mock('fs');
const fs = require('fs');
const path = require('path');
const deploymentConfigPath = path.resolve(__dirname, '../../src/backend/utils/deployment-config.js');

describe('deployment-config', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('readDeploymentVersion returns default when config file missing', () => {
    fs.existsSync.mockReturnValue(false);
    const { readDeploymentVersion, DEFAULT_DEPLOYMENT_VERSION } = require(deploymentConfigPath);
    expect(readDeploymentVersion()).toBe(DEFAULT_DEPLOYMENT_VERSION);
  });

  test('readDeploymentVersion reads and normalizes deployment_info.version', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({
        admin: {},
        deployment_info: { version: '2.1.0' },
      })
    );
    const { readDeploymentVersion } = require(deploymentConfigPath);
    expect(readDeploymentVersion()).toBe('2.1.0.0');
  });

  test('writeDeploymentVersion merges deployment_info and normalizes', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(
      JSON.stringify({ admin: { x: 1 }, deployment_info: { version: '1.0.0.0' } }, null, 2)
    );
    const { writeDeploymentVersion } = require(deploymentConfigPath);
    writeDeploymentVersion('3.0.0');
    expect(fs.writeFileSync).toHaveBeenCalled();
    const written = fs.writeFileSync.mock.calls[0][1];
    const parsed = JSON.parse(written);
    expect(parsed.deployment_info.version).toBe('3.0.0.0');
    expect(parsed.admin.x).toBe(1);
  });

  test('writeDeploymentVersion throws for invalid version', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('{}');
    const { writeDeploymentVersion } = require(deploymentConfigPath);
    expect(() => writeDeploymentVersion('not-a-version')).toThrow('Invalid version format');
  });
});
