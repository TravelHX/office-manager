const {
  parseVersion,
  formatVersion,
  incrementVersion,
  compareVersions,
  isValidVersion,
} = require('../../src/backend/utils/semantic-version');

describe('Semantic Version Utilities', () => {
  describe('parseVersion', () => {
    test('should parse valid version string', () => {
      const version = parseVersion('1.2.3');
      expect(version).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    test('should parse version with leading/trailing spaces', () => {
      const version = parseVersion('  1.2.3  ');
      expect(version).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    test('should throw error for invalid format', () => {
      expect(() => parseVersion('1.2')).toThrow('Invalid version format');
      expect(() => parseVersion('1.2.3.4')).toThrow('Invalid version format');
      expect(() => parseVersion('invalid')).toThrow('Invalid version format');
    });

    test('should throw error for non-numeric parts', () => {
      expect(() => parseVersion('1.2.a')).toThrow('All parts must be numbers');
      expect(() => parseVersion('a.b.c')).toThrow('All parts must be numbers');
    });

    test('should throw error for negative numbers', () => {
      expect(() => parseVersion('-1.2.3')).toThrow('cannot be negative');
      expect(() => parseVersion('1.-2.3')).toThrow('cannot be negative');
    });
  });

  describe('formatVersion', () => {
    test('should format version object to string', () => {
      const version = { major: 1, minor: 2, patch: 3 };
      expect(formatVersion(version)).toBe('1.2.3');
    });

    test('should throw error for invalid version object', () => {
      expect(() => formatVersion({ major: 1 })).toThrow('Invalid version object');
      expect(() => formatVersion(null)).toThrow('Invalid version object');
    });
  });

  describe('incrementVersion', () => {
    test('should increment patch version', () => {
      expect(incrementVersion('1.2.3', 'patch')).toBe('1.2.4');
      expect(incrementVersion('1.2.0', 'patch')).toBe('1.2.1');
    });

    test('should increment minor version and reset patch', () => {
      expect(incrementVersion('1.2.3', 'minor')).toBe('1.3.0');
      expect(incrementVersion('1.2.0', 'minor')).toBe('1.3.0');
    });

    test('should increment major version and reset minor and patch', () => {
      expect(incrementVersion('1.2.3', 'major')).toBe('2.0.0');
      expect(incrementVersion('1.0.0', 'major')).toBe('2.0.0');
    });

    test('should default to patch increment', () => {
      expect(incrementVersion('1.2.3')).toBe('1.2.4');
    });

    test('should throw error for invalid increment type', () => {
      expect(() => incrementVersion('1.2.3', 'invalid')).toThrow('Invalid increment type');
    });
  });

  describe('compareVersions', () => {
    test('should return -1 when version1 < version2', () => {
      expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
      expect(compareVersions('1.2.3', '1.3.0')).toBe(-1);
      expect(compareVersions('1.2.3', '2.0.0')).toBe(-1);
    });

    test('should return 1 when version1 > version2', () => {
      expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
      expect(compareVersions('1.3.0', '1.2.3')).toBe(1);
      expect(compareVersions('2.0.0', '1.2.3')).toBe(1);
    });

    test('should return 0 when versions are equal', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });
  });

  describe('isValidVersion', () => {
    test('should return true for valid versions', () => {
      expect(isValidVersion('1.2.3')).toBe(true);
      expect(isValidVersion('0.1.0')).toBe(true);
      expect(isValidVersion('10.20.30')).toBe(true);
    });

    test('should return false for invalid versions', () => {
      expect(isValidVersion('1.2')).toBe(false);
      expect(isValidVersion('1.2.3.4')).toBe(false);
      expect(isValidVersion('invalid')).toBe(false);
      expect(isValidVersion('1.2.a')).toBe(false);
      expect(isValidVersion('')).toBe(false);
      expect(isValidVersion(null)).toBe(false);
    });
  });
});
