const { hashPassword, verifyPassword } = require('../../src/backend/utils/password');

describe('Password Utilities', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const plainPassword = 'testpassword123';
      const hash = await hashPassword(plainPassword);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(plainPassword);
      expect(hash.length).toBeGreaterThan(20); // bcrypt hashes are long
    });

    it('should produce different hashes for the same password', async () => {
      const plainPassword = 'testpassword123';
      const hash1 = await hashPassword(plainPassword);
      const hash2 = await hashPassword(plainPassword);

      // bcrypt includes salt, so same password produces different hashes
      expect(hash1).not.toBe(hash2);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
      await expect(hashPassword('   ')).rejects.toThrow('Password cannot be empty');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const plainPassword = 'testpassword123';
      const hash = await hashPassword(plainPassword);

      const isValid = await verifyPassword(plainPassword, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const plainPassword = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = await hashPassword(plainPassword);

      const isValid = await verifyPassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty password', async () => {
      const hash = await hashPassword('testpassword123');

      const isValid = await verifyPassword('', hash);
      expect(isValid).toBe(false);
    });

    it('should return false for empty hash', async () => {
      const isValid = await verifyPassword('testpassword123', '');
      expect(isValid).toBe(false);
    });

    it('should return false for null values', async () => {
      const isValid1 = await verifyPassword(null, 'hash');
      const isValid2 = await verifyPassword('password', null);
      
      expect(isValid1).toBe(false);
      expect(isValid2).toBe(false);
    });
  });
});

