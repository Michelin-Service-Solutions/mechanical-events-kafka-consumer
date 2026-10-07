import type { PipelineEnv } from '@michelin/cdk-pipeline';
import { VpcAttributes } from 'aws-cdk-lib/aws-ec2';

export interface ECSPipelineEnv extends PipelineEnv {
  readonly docker: {
    readonly username: string;
    readonly password: string;
  };
}
export interface MyEnv extends ECSPipelineEnv {
  readonly imageRegistryAccount?: string;

  // VPC
  readonly vpcConfig: {
    readonly props: VpcAttributes; // VPC properties (used to access MySQL clusters, Redis, etc)
    readonly securityGroupId: string; // Security group to use
  };

  // S3
  readonly service: {
    readonly clusterName: string;
    readonly loadBalancerArn: string;
  };

  readonly kafka: {
    readonly kafkaCredName: string;
  };

  readonly appToken: string;
  readonly maxRetries: number;
  readonly elasticSearchUrl: string;
  readonly emailNotificationUrl: string;
  readonly dryRun: boolean;
}
