import { env } from './env';
import { environment as integration, name } from './env_integration';
import { MyEnv } from './interface';

export const environment: MyEnv = {
  ...integration,

  // AWS
  awsEnv: {
    account: '380993790599',
    region: 'us-east-1',
  },

  branches: {
    current: 'staging',
    version: 'integration',
    release: 'testing',
  },

  // VPC
  vpcConfig: {
    props: {
      vpcId: 'vpc-0b40b0f9948486d2a',
      availabilityZones: ['us-east-1e'],
      privateSubnetIds: ['subnet-0ba9f9d4333f364b5', 'subnet-0db90a5e3cab31e84'],
    },
    securityGroupId: 'sg-0f56ef4f8af53108d',
  },

  service: {
    clusterName: 'misp-services-staging',
    loadBalancerArn:
      'arn:aws:elasticloadbalancing:us-east-1:380993790599:loadbalancer/app/staging-load-balancer/a2102ab808817fa8',
  },

  kafka: {
    kafkaCredName: 'AmazonMSK_/staging/sasl_credentials_with_key',
  },

  appToken: '/central_prod/staging/kafka_oncall_notifications/app_token',

  docker: {
    username: 'michelinservicesolutionsci',
    password: '/docker/prod/api/token',
  },
  elasticSearchUrl: `https://apigateway.${env}.misp-solutions.com/elasticsearch/lambdaproxy`,
  emailNotificationUrl: `https://api.${env}.misp-solutions.com/notifications`,
  dryRun: true,
};
