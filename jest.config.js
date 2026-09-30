/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    moduleFileExtensions: ['ts','js'],
    moduleNameMapper: { 
        '^src/(.*)': '<rootDir>/src/$1',     
    },
    modulePathIgnorePatterns: ['cdk'],
    preset: 'ts-jest',
    roots: ['<rootDir>/test'],
    setupFiles: ['<rootDir>/test/setup/mocks.ts'],
    setupFilesAfterEnv: ['<rootDir>/test/setup/setup.ts'],
    testEnvironment: 'node',
    testMatch: ['**/*.test.ts'],
    testTimeout: 300000,// 5min
  };