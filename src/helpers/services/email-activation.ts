import { GetParameterCommand, ParameterAlreadyExists, ParameterNotFound, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import type { Application } from '../../declarations';

export const emailActivationPath = 'emailActivation';

export interface EmailActivation {
  getTime(): Promise<number>;
}

// Written once with Overwrite=false, so redeployments and restarts keep the original activation time.
export async function resolveActivationTime(
  ssm: Pick<SSMClient, 'send'>,
  parameterName: string,
  initialValue: string,
): Promise<string> {
  try {
    const existing = await ssm.send(new GetParameterCommand({ Name: parameterName }));
    return existing.Parameter!.Value!;
  } catch (error) {
    if (!(error instanceof ParameterNotFound)) throw error;
  }

  try {
    await ssm.send(new PutParameterCommand({ Name: parameterName, Value: initialValue, Type: 'String', Overwrite: false }));
    console.log(JSON.stringify({ emailActivation: 'created', parameterName, activationTime: initialValue }));
    return initialValue;
  } catch (error) {
    if (!(error instanceof ParameterAlreadyExists)) throw error;
    const existing = await ssm.send(new GetParameterCommand({ Name: parameterName }));
    return existing.Parameter!.Value!;
  }
}

export function createEmailActivation(load: () => Promise<string>): EmailActivation {
  let pending: Promise<number> | undefined;
  return {
    getTime() {
      pending ??= load().then((value) => {
        const time = Date.parse(value);
        if (Number.isNaN(time)) throw new Error(`Invalid email activation time: ${value}`);
        return time;
      }).catch((error) => {
        pending = undefined;
        throw error;
      });
      return pending;
    },
  };
}

export const emailActivation = (app: Application): void => {
  const parameterName = app.get('emailActivationParameter');
  const initialValue = app.get('emailStartDate') ?? new Date().toISOString();
  const ssm = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
  const activation = createEmailActivation(() => resolveActivationTime(ssm, parameterName, initialValue));
  app.set(emailActivationPath, activation);
  // Resolve at startup so the activation time reflects deployment, not the first rolling message.
  activation.getTime().catch((error) => console.error('Email activation time could not be resolved yet', error));
};
