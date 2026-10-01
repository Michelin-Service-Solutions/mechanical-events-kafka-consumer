import { describe, expect, jest, test } from '@jest/globals';
import knex from 'knex';
import { MechanicalCaseData } from 'src/helpers/services/mechanical-case-data';
import type { Application } from 'src/declarations';

describe('MechanicalCaseData', () => {
  test('enriches DMS records that only carry EventNumber', async () => {
    const compiler = knex({ client: 'pg' });
    const raw = jest.fn(async (sql: string, bindings: unknown[]) => {
      compiler.raw(sql, bindings as any).toSQL();
      return { rows: [{ EventNumber: '9577915', ShipTo: '1145733' }] };
    });
    const app = { get: () => ({ raw }) } as unknown as Application;

    const result = await new MechanicalCaseData(app).get({ EventNumber: '9577915', Complaint: 'From Kafka' });

    expect(raw.mock.calls[0][1]).toEqual([null, '9577915']);
    expect(result).toMatchObject({ EventNumber: '9577915', ShipTo: '1145733', Complaint: 'From Kafka' });
  });
});
