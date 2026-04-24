module.exports = {
  rootDir: process.cwd(),
  testEnvironment: 'node',
  // Restrict haste-map/module scanning so Jest does not see both /package.json and
  // /src/frontend/package.json (identical names cause a haste collision when the test
  // container volume-mounts src/frontend on top of the Dockerfile's renamed copy).
  roots: ['<rootDir>/tests', '<rootDir>/src/backend'],
  modulePathIgnorePatterns: ['<rootDir>/src/frontend/'],
  // Only the repo-root tests/ tree (not src/frontend/tests; those run via frontend Jest)
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/backend/**/*.js',
    '!src/backend/server.js',
    '!src/backend/config/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/backend/services/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/backend/repositories/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};

