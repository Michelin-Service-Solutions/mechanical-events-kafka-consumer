import { environment as integration, name } from './env_integration';
import { MyEnv } from './interface';
import { env } from './env';


export const environment: MyEnv = {
  ...integration,

  // AWS
  awsEnv: {
    account: '380993790599',
    region: 'us-east-1',
  },

  branches: {
    current: 'production',
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
    securityGroupId: 'sg-09b46c10534616d1c',
  },

  service: {
    ...integration.service,
    clusterName: 'misp-services-production',
    loadBalancerArn:
      'arn:aws:elasticloadbalancing:us-east-1:380993790599:loadbalancer/app/production-load-balancer/6fedda41b8f13c1e',
  },
  docker: {
    username: 'michelinservicesolutionsci',
    password: '/docker/prod/api/token',
  },
  kafka: {
    kafkaCredName: 'AmazonMSK_/prod/sasl_credentials_with_key',
  },
 
  appToken: '/central_prod/production/kafka_oncall_notifications/app_token',
  elasticSearchUrl: `https://apigateway.${env}.misp-solutions.com/elasticsearch/lambdaproxy`,
  emailNotificationUrl: `https://api.${env}.misp-solutions.com/notifications`,
  dryRun: true,

};
