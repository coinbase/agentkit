const baseConfig = require("../../jest.config.base.cjs");

module.exports = {
  ...baseConfig,
  setupFilesAfterEnv: ["<rootDir>/setup-jest.js"],
  coveragePathIgnorePatterns: ["node_modules", "dist", "docs", "index.ts"],
  coverageThreshold: {},
};
