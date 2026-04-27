/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        noUncheckedIndexedAccess: true,
      },
    }],
  },
  collectCoverageFrom: [
    'lib/fraud-logic/**/*.ts',
    'lib/parsers/**/*.ts',
    '!lib/fraud-logic/index.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};

module.exports = config;
