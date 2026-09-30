import { CfnOutput, Stack } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import type { MyEnv } from '../config/interface';
import type { SecondaryStackProps } from './components/interfaces';
import * as sqs from 'aws-cdk-lib/aws-sqs'

export class SecondaryStack extends Stack {
  private myEnv: MyEnv;

  constructor(scope: Construct, id: string, props: SecondaryStackProps) {
    super(scope, id, props);
    this.myEnv = props.myEnv;

    // Create an SQS queue
    ['retryQueue', 'dlqQueue'].forEach($queueName => this.createSQS($queueName));
  }

  private createSQS(queueName: string) {
    const retryQueueName = `${this.myEnv.appName}-${queueName}-${this.myEnv.environment}`;
    const queue = new sqs.Queue(this, queueName, {
      queueName: retryQueueName,
    });
    new CfnOutput(this, `${retryQueueName}-ARN`, {
      value: queue.queueArn,
      exportName: `${retryQueueName}-ARN`,
    });
    new CfnOutput(this, `${retryQueueName}-URL`, {
      value: queue.queueUrl,
      exportName: `${retryQueueName}-URL`,
    });
  }
}
