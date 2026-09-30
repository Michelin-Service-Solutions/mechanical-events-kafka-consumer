import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { myEnv } from '../config/env';
import { MainStack } from './main-stack';

// CDK stack components are added to the stack automatically, so we don't need to work with the new object sometimes.
/* eslint-disable no-new */

export class DeployStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    new MainStack(this, `${myEnv.appName}-${myEnv.environment}-MainStk`, { myEnv, env: myEnv.awsEnv });
  }
}
