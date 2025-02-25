const baseConfig = require("../../jest.config.base.cjs");

module.exports = {
  ...baseConfig,
  coveragePathIgnorePatterns: ["node_modules", "dist", "docs", "index.ts"],
  coverageThreshold: {},
};
