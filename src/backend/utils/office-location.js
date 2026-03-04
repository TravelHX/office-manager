/**
 * Office Location Constants
 * Hardcoded list of valid office locations
 */
const OFFICE_LOCATIONS = {
  LONDON: 'London',
  PRAGUE: 'Prague',
};

/**
 * Get all valid office locations
 * @returns {Array<string>} Array of valid office location strings
 */
function getAllOfficeLocations() {
  return Object.values(OFFICE_LOCATIONS);
}

/**
 * Check if an office location is valid
 * @param {string} location - Office location to validate
 * @returns {boolean} True if location is valid, false otherwise
 */
function isValidOfficeLocation(location) {
  return Object.values(OFFICE_LOCATIONS).includes(location);
}

module.exports = {
  OFFICE_LOCATIONS,
  getAllOfficeLocations,
  isValidOfficeLocation,
};
