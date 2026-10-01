import { Duration, Fn, Stack, aws_secretsmanager } from 'aws-cdk-lib';
import { ISecurityGroup, IVpc, Subnet, Peer, Port } from 'aws-cdk-lib/aws-ec2';

import { Secret } from 'aws-cdk-lib/aws-ecs';

import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { MyEnv } from '../config/interface';
import { MainStackProps } from './components/interfaces';
import { importSecurityGroup, importSubnets, importVPC } from './components/networking';
import { createECS } from './components/ecsService';




// This rule mistakes the AWS lambda 'Function' class with the JS 'Function' interface: https://typescript-eslint.io/rules/ban-types/
/* eslint-disable @typescript-eslint/ban-types */

export class MainStack extends Stack {
  private myEnv: MyEnv;


  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    this.myEnv = props.myEnv;
    const imageTag = process.env.IMAGE_TAG ?? process.env.version;
    if (!imageTag) throw new Error('IMAGE_TAG is required to deploy MainStack');

    const vpc: IVpc = importVPC(this, this.myEnv.vpcConfig.props);
    const securityGroups: ISecurityGroup[] = [importSecurityGroup(this, this.myEnv.vpcConfig.securityGroupId)];
    // Allowed subnets of service
    const subnets = importSubnets(this, this.myEnv.vpcConfig.props.privateSubnetIds);

    createECS(this,
      this.myEnv.appName,
      this.myEnv.environment,
      vpc,
      securityGroups,
      subnets,
      this.myEnv.service.clusterName,
      this.myEnv.awsEnv.account,
      this.myEnv.awsEnv.region,
      this.myEnv.service.loadBalancerArn,
      this.myEnv.imageRegistryAccount ?? this.myEnv.awsEnv.account,
      this.createECSTaskDefinitionEnv(),
      this.createECSTaskDefinitionSecrets(),
      imageTag);


  }


  createECSTaskDefinitionEnv(): { [key: string]: string } {

    const retryQueueURL = Fn.importValue(`${this.myEnv.appName}-retryQueue-${this.myEnv.environment}-URL`);
    const dlqQueueURL = Fn.importValue(`${this.myEnv.appName}-dlqQueue-${this.myEnv.environment}-URL`);
    const auditsBusARN = `arn:aws:events:${this.myEnv.awsEnv.region}:${this.myEnv.awsEnv.account}:event-bus/${this.myEnv.auditsBusName}`;


    return {
      APP_NAME: this.myEnv.appName,
      CENTRAL_HOST: `${this.myEnv.baseURL}/central`,
      AWS_REGION: this.myEnv.awsEnv.region,
      NODE_ENV: this.myEnv.environment,
      ROOT_URL: this.myEnv.appName,
      ELASTICSEARCH_URL: this.myEnv.elasticSearchUrl,
      EMAIL_NOTIFICATION_URL: this.myEnv.emailNotificationUrl,
      DRY_RUN: String(this.myEnv.dryRun),

      KAFKA_CONSUMER_GROUP: `${this.myEnv.environment}.${this.myEnv.appName}`,

      REDIS: JSON.stringify(this.myEnv.redis),
      BASE_URL: `${this.myEnv.baseURL}/${this.myEnv.appName}`,

      ONCALL_DB_HOST: this.myEnv.oncallDB.host,
      ONCALL_DB_PORT: this.myEnv.oncallDB.port,
      ONCALL_DB_NAME: this.myEnv.oncallDB.database,

      LAST_UPDATE: new Date().toISOString(),
      AUDITS_ARN: auditsBusARN,

      RETRY_QUEUE_URL: retryQueueURL,
      DLQ_QUEUE_URL: dlqQueueURL,
      MAX_RETRIES: this.myEnv.maxRetries.toString(),
    }
  }

  createECSTaskDefinitionSecrets() {
    return {
      KAFKA_USERNAME: Secret.fromSecretsManager(
        aws_secretsmanager.Secret.fromSecretNameV2(this, 'KafkaCreds-username', this.myEnv.kafka.kafkaCredName),
        'username'
      ),
      KAFKA_PASSWORD: Secret.fromSecretsManager(
        aws_secretsmanager.Secret.fromSecretNameV2(this, 'KafkaCreds-password', this.myEnv.kafka.kafkaCredName),
        'password'
      ),

      APP_TOKEN: Secret.fromSsmParameter(
        StringParameter.fromSecureStringParameterAttributes(this, 'APP_TOKEN', {
          parameterName: this.myEnv.appToken,
        }),
      ),
      MIDDLEWARE_USERNAME: Secret.fromSsmParameter(
        StringParameter.fromSecureStringParameterAttributes(this, 'MIDDLEWARE_USERNAME', {
          parameterName: this.myEnv.middleware.username,
        }),
      ),
      MIDDLEWARE_PASSWORD: Secret.fromSsmParameter(
        StringParameter.fromSecureStringParameterAttributes(this, 'MIDDLEWARE_PASSWORD', {
          parameterName: this.myEnv.middleware.password,
        }),
      ),
      ONCALL_DB_USER: Secret.fromSsmParameter(
        StringParameter.fromSecureStringParameterAttributes(this, 'ONCALL_DB_USER', {
          parameterName: this.myEnv.oncallDB.username,
        }),
      ),
      ONCALL_DB_PASSWORD: Secret.fromSsmParameter(
        StringParameter.fromSecureStringParameterAttributes(this, 'ONCALL_DB_PASSWORD', {
          parameterName: this.myEnv.oncallDB.password,
        }),
      ),

    }
  }
}
