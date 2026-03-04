const { generateResetToken, calculateTokenExpiry, isTokenExpired } = require('../../src/backend/utils/reset-token');

describe('Reset Token Utilities', () => {
  describe('generateResetToken', () => {
    it('should generate a token string', () => {
      const token = generateResetToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate unique tokens', () => {
      const token1 = generateResetToken();
      const token2 = generateResetToken();
      expect(token1).not.toBe(token2);
    });

    it('should generate tokens of correct length (64 hex characters)', () => {
      const token = generateResetToken();
      expect(token.length).toBe(64);
    });
  });

  describe('calculateTokenExpiry', () => {
    it('should calculate expiry 1 hour from now by default', () => {
      const now = new Date();
      const expiry = calculateTokenExpiry();
      
      const diff = expiry.getTime() - now.getTime();
      const hours = diff / (1000 * 60 * 60);
      
      expect(hours).toBeCloseTo(1, 1);
    });

    it('should calculate expiry with custom hours', () => {
      const now = new Date();
      const expiry = calculateTokenExpiry(2);
      
      const diff = expiry.getTime() - now.getTime();
      const hours = diff / (1000 * 60 * 60);
      
      expect(hours).toBeCloseTo(2, 1);
    });

    it('should return a Date object', () => {
      const expiry = calculateTokenExpiry();
      expect(expiry).toBeInstanceOf(Date);
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for future dates', () => {
      const future = new Date();
      future.setHours(future.getHours() + 1);
      expect(isTokenExpired(future)).toBe(false);
    });

    it('should return true for past dates', () => {
      const past = new Date();
      past.setHours(past.getHours() - 1);
      expect(isTokenExpired(past)).toBe(true);
    });

    it('should return true for null', () => {
      expect(isTokenExpired(null)).toBe(true);
    });

    it('should return true for undefined', () => {
      expect(isTokenExpired(undefined)).toBe(true);
    });

    it('should handle date strings', () => {
      const future = new Date();
      future.setHours(future.getHours() + 1);
      expect(isTokenExpired(future.toISOString())).toBe(false);

      const past = new Date();
      past.setHours(past.getHours() - 1);
      expect(isTokenExpired(past.toISOString())).toBe(true);
    });
  });
});
