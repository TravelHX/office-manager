const { getAllOfficeLocations, isValidOfficeLocation, OFFICE_LOCATIONS } = require('../../src/backend/utils/office-location');

describe('Office Location Utilities', () => {
  describe('getAllOfficeLocations', () => {
    it('should return all valid office locations', () => {
      const locations = getAllOfficeLocations();
      expect(locations).toContain('London');
      expect(locations).toContain('Prague');
      expect(locations.length).toBe(2);
    });
  });

  describe('isValidOfficeLocation', () => {
    it('should validate London', () => {
      expect(isValidOfficeLocation('London')).toBe(true);
    });

    it('should validate Prague', () => {
      expect(isValidOfficeLocation('Prague')).toBe(true);
    });

    it('should reject invalid locations', () => {
      expect(isValidOfficeLocation('New York')).toBe(false);
      expect(isValidOfficeLocation('Paris')).toBe(false);
      expect(isValidOfficeLocation('')).toBe(false);
      expect(isValidOfficeLocation(null)).toBe(false);
      expect(isValidOfficeLocation(undefined)).toBe(false);
    });

    it('should be case-sensitive', () => {
      expect(isValidOfficeLocation('london')).toBe(false);
      expect(isValidOfficeLocation('LONDON')).toBe(false);
      expect(isValidOfficeLocation('prague')).toBe(false);
    });
  });

  describe('OFFICE_LOCATIONS constant', () => {
    it('should have correct values', () => {
      expect(OFFICE_LOCATIONS.LONDON).toBe('London');
      expect(OFFICE_LOCATIONS.PRAGUE).toBe('Prague');
    });
  });
});
