import { App } from 'aws-cdk-lib';
import { myEnv } from '../config/env';
import { MainStack } from '../lib/main-stack';
import { PipelineStack } from '../lib/pipeline-stack';
import { SecondaryStack } from '../lib/secondary-stack';
import { SharedPipelineStack } from '../lib/shared-pipeline-stack';
import { DeploymentRoleStack } from '../lib/deployment-role-stack';

// CDK stack components are added to the app automatically, so we don't need to work with the new object sometimes.
/* eslint-disable no-new */

const app: App = new App();

if (process.env.CDK_MODE === 'shared-pipeline') {
  new SharedPipelineStack(app, 'mechanical-events-kafka-consumer-SharedPipelineStack');
} else if (process.env.CDK_MODE === 'deployment-role') {
  const target = process.env.BOOTSTRAP_TARGET as 'dev' | 'test' | 'stg' | 'prod';
  const account = target === 'dev' || target === 'test' ? '540573004174' : '380993790599';
  const targetName = target === 'dev' ? 'development' : target === 'stg' ? 'staging' : target === 'prod' ? 'production' : 'test';
  new DeploymentRoleStack(app, `mechanical-events-kafka-consumer-${target}-DeploymentRoleStack`, {
    env: { account, region: 'us-east-1' }, target: targetName,
  });
} else if (process.env.CDK_MODE === 'application') {
  new MainStack(app, `${myEnv.appName}-${myEnv.environment}-MainStack`, { env: myEnv.awsEnv, myEnv: { ...myEnv, imageRegistryAccount: process.env.IMAGE_REGISTRY_ACCOUNT ?? myEnv.imageRegistryAccount } });
  new SecondaryStack(app, `${myEnv.appName}-${myEnv.environment}-SecondaryStack`, { env: myEnv.awsEnv, myEnv });
} else {
  new MainStack(app, `${myEnv.appName}-${myEnv.environment}-MainStack`, { env: myEnv.awsEnv, myEnv });
  new SecondaryStack(app, `${myEnv.appName}-${myEnv.environment}-SecondaryStack`, { env: myEnv.awsEnv, myEnv });
  new PipelineStack(app, `${myEnv.appName}-${myEnv.environment}-PipelineStack`, { env: myEnv.awsEnv, myEnv });
}
