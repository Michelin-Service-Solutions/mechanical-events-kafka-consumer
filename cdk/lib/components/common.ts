import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { DBConnection, MyEnv } from '../../config/interface';

export const nodeRuntime: Runtime = Runtime.NODEJS_22_X;
const dbConnection: DBConnection = {
  username: '',
  password: '',
  host: '',
  port: '',
  database: '',
}

/**
 * Dummy environment to simplify unit tests, while keeping strong typing.
 */
export const emptyEnv: MyEnv = {
  appName: 'FakeAppName',
  awsEnv: {
    account: '',
    region: '',
  },
  branches: {
    current: '',
    release: '',
    version: '',
  },
  environment: 'local',
  githubRepoName: '',
  vpcConfig: {
    props: {
      availabilityZones: [],
      vpcId: '',
    },
    securityGroupId: '',
  },

  service: {
    clusterName: '',
    loadBalancerArn: '',
  },
  docker: {
    username: '',
    password: '',
  },
  kafka: {
    kafkaCredName: '',
  },
  baseURL: '',
  redis: {
    host: '',
  },

  appToken: '',
  maxRetries: 20,
  middleware: {
    username: '',
    password: '',
  },
  elasticSearchUrl: '',
  emailNotificationUrl: '',
  dryRun: true,


  oncallDB: dbConnection,
  auditsBusName: '',
};
