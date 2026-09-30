import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { PipelineStackProps } from './components/interfaces';
import { DeployStage } from './deploy-stage';
import { BuildEnvironmentVariable, BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild';
import { CdkPipelineHelper } from '@michelin/cdk-pipeline';


export class PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const deployStage = new DeployStage(this, `${props.myEnv.appName}-${props.myEnv.environment}-DeployStage`);

 const buildStepEnvVars: { [name: string]: BuildEnvironmentVariable } ={
    dockerAccountUsername: {
      value: props.myEnv.docker.username,
      type: BuildEnvironmentVariableType.PLAINTEXT,
    },
    dockerAccountPassword: {
      value: props.myEnv.docker.password,
      type: BuildEnvironmentVariableType.PARAMETER_STORE,
    },
    EcrRepo: {
      value: `misp/${props.myEnv.appName.toLowerCase()}`,
      type: BuildEnvironmentVariableType.PLAINTEXT,
    },
    environment: {
      value: props.myEnv.environment,
      type: BuildEnvironmentVariableType.PLAINTEXT,
    },
    AWSAccount: {
      value: props.myEnv.awsEnv.account,
      type: BuildEnvironmentVariableType.PLAINTEXT,
    }
  };

    new CdkPipelineHelper(this, props.myEnv, deployStage, {      
      buildStepEnvVars,      
      includeECS: true      
   }).build();
  }
}
