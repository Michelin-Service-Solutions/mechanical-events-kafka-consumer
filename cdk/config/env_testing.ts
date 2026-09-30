import { env } from './env';
import { environment as integration } from './env_integration';
import { MyEnv } from './interface';

export const environment: MyEnv = {
  ...integration,

  appToken: '/central_dev/testing/kafka_oncall_notifications/app_token',

  // GitHub
  branches: {
    current: 'testing',
    version: 'integration',
    release: 'testing',
  },

  // VPC
  vpcConfig: {
    props: {
      vpcId: 'vpc-0356a90607756dbff',
      availabilityZones: ['us-east-1e'],
      privateSubnetIds: ['subnet-0f7aed5e770e8b447', 'subnet-0b2328a00732c7438'],
    },
    securityGroupId: 'sg-075a817b2f9e33ef4',
  },

  service: {
    clusterName: 'misp-services-test',
    loadBalancerArn:
      'arn:aws:elasticloadbalancing:us-east-1:540573004174:loadbalancer/app/testing-load-balancer/77d8f7b1404741aa',
  },

  kafka: {
    kafkaCredName: 'AmazonMSK_/Testsecret2/sasl_credentials_with_key',
  },
  oncallDB: {
    username: `/oncall_test/${env}/cases_db/userName`,
    password: `/oncall_test/${env}/cases_db/password`,
    host: 'oncall-test-rds.cwkobdc3y45e.us-east-1.rds.amazonaws.com',
    port: '5432',
    database: 'case_prod',
  },
  elasticSearchUrl: `https://apigateway.${env}.misp-solutions.com/elasticsearch/lambdaproxy`,
  emailNotificationUrl: `https://api.${env}.misp-solutions.com/notifications`,
  dryRun: true,

};
