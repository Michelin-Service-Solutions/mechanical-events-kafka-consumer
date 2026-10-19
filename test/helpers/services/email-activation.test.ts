import { describe, expect, jest, test } from '@jest/globals';
import { GetParameterCommand, ParameterAlreadyExists, ParameterNotFound, PutParameterCommand } from '@aws-sdk/client-ssm';
import { createEmailActivation, resolveActivationTime } from 'src/helpers/services/email-activation';

const notFound = () => new ParameterNotFound({ message: 'not found', $metadata: {} });
const alreadyExists = () => new ParameterAlreadyExists({ message: 'exists', $metadata: {} });

describe('resolveActivationTime', () => {
  test('keeps the existing activation time on redeployment', async () => {
    const send: any = jest.fn(async () => ({ Parameter: { Value: '2026-10-01T00:00:00.000Z' } }));
    await expect(resolveActivationTime({ send }, '/p', '2026-10-19T00:00:00.000Z')).resolves.toBe('2026-10-01T00:00:00.000Z');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetParameterCommand);
  });

  test('creates the activation time once without overwriting', async () => {
    const send: any = jest.fn(async (command: unknown) => {
      if (command instanceof GetParameterCommand) throw notFound();
      return {};
    });
    await expect(resolveActivationTime({ send }, '/p', '2026-10-19T00:00:00.000Z')).resolves.toBe('2026-10-19T00:00:00.000Z');
    const put = send.mock.calls[1][0] as PutParameterCommand;
    expect(put).toBeInstanceOf(PutParameterCommand);
    expect(put.input).toEqual({ Name: '/p', Value: '2026-10-19T00:00:00.000Z', Type: 'String', Overwrite: false });
  });

  test('uses the value written by another task when both start together', async () => {
    let gets = 0;
    const send: any = jest.fn(async (command: unknown) => {
      if (command instanceof GetParameterCommand) {
        gets += 1;
        if (gets === 1) throw notFound();
        return { Parameter: { Value: '2026-10-18T00:00:00.000Z' } };
      }
      throw alreadyExists();
    });
    await expect(resolveActivationTime({ send }, '/p', '2026-10-19T00:00:00.000Z')).resolves.toBe('2026-10-18T00:00:00.000Z');
  });
});

describe('createEmailActivation', () => {
  test('loads once and retries after a failure', async () => {
    const load: any = jest.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('ssm down'))
      .mockResolvedValue('2026-10-19T00:00:00.000Z');
    const activation = createEmailActivation(load);

    await expect(activation.getTime()).rejects.toThrow('ssm down');
    await expect(activation.getTime()).resolves.toBe(Date.parse('2026-10-19T00:00:00.000Z'));
    await activation.getTime();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
