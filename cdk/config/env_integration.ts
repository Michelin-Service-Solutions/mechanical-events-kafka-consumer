import { env } from './env';
import { MyEnv } from './interface';

export const name="mechanical-events-kafka-consumer";
export const environment: MyEnv = {
  // AWS
  awsEnv: {
    account: '540573004174',
    region: 'us-east-1',
  },

  // Application
  environment: env,
  appName: name,

  // GitHub
  githubRepoName: name,
  branches: {
    current: 'integration',
    version: 'integration',
    release: 'testing',
  },

  // Jira
  jira: {
    project: 1,
    prefix: '',
  },

  // VPC
  vpcConfig: {
    props: {
      vpcId: 'vpc-0356a90607756dbff',
      availabilityZones: ['us-east-1e'],
      privateSubnetIds: ['subnet-0f7aed5e770e8b447', 'subnet-0b2328a00732c7438'],
    },
    securityGroupId: 'sg-0cd8673a496bf5307',
  },

  service: {
    clusterName: `misp-services-${env}`,
    loadBalancerArn:
      'arn:aws:elasticloadbalancing:us-east-1:540573004174:loadbalancer/app/staging-load-balancer/8c11b1be07e4016e',
  },

  docker: {
    username: 'dockeraccountmichelindev',
    password: '/docker/dev/api/token',
  },
  kafka: {
    kafkaCredName: `AmazonMSK_/${env}/sasl_credentials_with_key`,// Secret name to connect to Kafka cluster
  },
  baseURL: `https://api.${env}.misp-solutions.com`,
  redis: {
    host: `redis://redis.${env}:6379`,
  },


  oncallDB: {
    username: `/oncall_dev/${env}/cases_db/username`,
    password: `/oncall_dev/${env}/cases_db/password`,
    host: 'oncall-rds-dev.ccn1m1f16pfd.us-east-1.rds.amazonaws.com',
    port: '5432',
    database: 'case_prod',
  },

  // Audits
  auditsBusName: `audits_${env}`,
  appToken: `/central_dev/${env}/kafka_oncall_notifications/app_token`,
  maxRetries: 20,
  middleware: {
    username: `/central_dev/${env}/open_api_oncall/ers_middleware_user`,
    password: `/central_dev/${env}/open_api_oncall/ers_middleware_password`,
  },
  elasticSearchUrl: `https://apigateway.${env}.misp-solutions.com/elasticsearch/lambdaproxy`,
  emailNotificationUrl: `https://api.${env}.misp-solutions.com/notifications`,
  dryRun: true,
};
