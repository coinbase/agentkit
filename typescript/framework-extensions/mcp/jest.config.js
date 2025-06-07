module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        module: 'commonjs',
        isolatedModules: true
      }
    }
  }
};
