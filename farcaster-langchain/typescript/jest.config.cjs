const baseConfig = require("../../jest.config.base.cjs");

module.exports = {
  ...baseConfig,
  coveragePathIgnorePatterns: ["node_modules", "dist", "docs", "index.ts"],
  coverageThreshold: {
    "./src/**": {
      branches: 30,
      functions: 50,
      statements: 50,
      lines: 50,
    },
  },
};
