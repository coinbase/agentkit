import type { Config } from "jest";

const config: Config = {
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
  transform: {},
  coverageThreshold: {
    global: {
      branches: 77,
      functions: 85,
      statements: 85,
      lines: 85,
    },
    "./src/**": {
      branches: 77,
      functions: 85,
      statements: 85,
      lines: 85,
    },
  },
};

export default config;
