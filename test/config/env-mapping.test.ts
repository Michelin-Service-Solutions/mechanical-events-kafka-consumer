import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'child_process';

const readConfig = (env: Record<string, string>) => JSON.parse(execFileSync(
  process.execPath,
  ['-e', "const c = require('config'); console.log(JSON.stringify({ fromBeginning: c.get('kafka.consumer.fromBeginning') }))"],
  { env: { ...process.env, NODE_ENV: 'integration', NODE_CONFIG_DIR: 'config', ...env }, encoding: 'utf8' },
).trim().split('\n').pop()!);

describe('environment variable mapping', () => {
  test('parses KAFKA_FROM_BEGINNING as a boolean', () => {
    expect(readConfig({ KAFKA_FROM_BEGINNING: 'false' })).toEqual({ fromBeginning: false });
    expect(readConfig({ KAFKA_FROM_BEGINNING: 'true' })).toEqual({ fromBeginning: true });
  });
});
