import { describe, expect, test } from '@jest/globals';
import { execFileSync } from 'child_process';

const readConfig = (env: Record<string, string>) => JSON.parse(execFileSync(
  process.execPath,
  ['-e', "const c = require('config'); console.log(JSON.stringify({ dryRun: c.get('dryRun'), fromBeginning: c.get('kafka.consumer.fromBeginning') }))"],
  { env: { ...process.env, NODE_ENV: 'integration', NODE_CONFIG_DIR: 'config', ...env }, encoding: 'utf8' },
).trim().split('\n').pop()!);

describe('environment variable mapping', () => {
  test('parses DRY_RUN and KAFKA_FROM_BEGINNING as booleans', () => {
    expect(readConfig({ DRY_RUN: 'false', KAFKA_FROM_BEGINNING: 'false' })).toEqual({ dryRun: false, fromBeginning: false });
    expect(readConfig({ DRY_RUN: 'true', KAFKA_FROM_BEGINNING: 'true' })).toEqual({ dryRun: true, fromBeginning: true });
  });
});
