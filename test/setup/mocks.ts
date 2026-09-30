import { jest } from "@jest/globals";


// Centralized mocks for services used across multiple test files

// Mock the schedule service
jest.mock('../../src/helpers/services/schedule', () => {
  const originalModule = jest.requireActual('../../src/helpers/services/schedule');
  return {
    ...(originalModule as any),
    scheduler: jest.fn()
  };
});

// Mock the kafka-manager service
jest.mock('../../src/helpers/services/kafka-manager', () => {
  const originalModule = jest.requireActual('../../src/helpers/services/kafka-manager');
  return {
    ...(originalModule as any),
    KafkaManagerService: jest.fn()
  };
});

// Mock node-fetch (commonly used across tests)
jest.mock('node-fetch');

