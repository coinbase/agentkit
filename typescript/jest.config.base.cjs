module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  coveragePathIgnorePatterns: ["node_modules", "dist", "docs"],
  collectCoverage: true,
  collectCoverageFrom: ["./src/**"],
  coverageReporters: ["html"],
  verbose: true,
  maxWorkers: 1,
  passWithNoTests: true,
  coverageThreshold: {
    "./src/**": {
      branches: 77,
      functions: 85,
      statements: 85,
      lines: 85,
    },
  },
};
