export interface PipelineTarget {
  readonly name: 'development' | 'test' | 'staging' | 'production';
  readonly deployEnv: 'integration' | 'testing' | 'staging' | 'production';
  readonly account: string;
  readonly roleArn: string;
  readonly approvalRequired: boolean;
}

const sharedAccount = process.env.SHARED_AWS_ACCOUNT_ID ?? '024972153933';
const devAccount = process.env.DEV_AWS_ACCOUNT_ID ?? '540573004174';
const prodAccount = process.env.PROD_AWS_ACCOUNT_ID ?? '380993790599';
const appName = 'mechanical-events-kafka-consumer';

const roleName = (target: string) => process.env[`${target.toUpperCase()}_DEPLOY_ROLE_NAME`]
  ?? `misp-${appName}-${target}-deploy-role`;

const allTargets: PipelineTarget[] = [
  { name: 'development', deployEnv: 'integration', account: devAccount, roleArn: `arn:aws:iam::${devAccount}:role/${roleName('development')}`, approvalRequired: false },
  { name: 'test', deployEnv: 'testing', account: devAccount, roleArn: `arn:aws:iam::${devAccount}:role/${roleName('test')}`, approvalRequired: true },
  { name: 'staging', deployEnv: 'staging', account: prodAccount, roleArn: `arn:aws:iam::${prodAccount}:role/${roleName('staging')}`, approvalRequired: true },
  { name: 'production', deployEnv: 'production', account: prodAccount, roleArn: `arn:aws:iam::${prodAccount}:role/${roleName('production')}`, approvalRequired: true },
];

const selected = (process.env.PIPELINE_TARGETS ?? 'development,test,staging,production')
  .split(',').map((target) => target.trim()).filter(Boolean);

export const sharedPipelineConfig = {
  appName,
  repositoryOwner: 'Michelin-Service-Solutions',
  repositoryName: appName,
  sourceBranch: process.env.PIPELINE_SOURCE_BRANCH ?? 'main',
  region: 'us-east-1',
  sharedAccount,
  targets: allTargets.filter((target) => selected.includes(target.name)),
};

export const sharedPipelineRoleName = process.env.SHARED_PIPELINE_ROLE_NAME
  ?? `misp-${appName}-pipeline-role`;
export const deploymentRoleNames = Object.fromEntries(
  allTargets.map((target) => [target.name, roleName(target.name)]),
) as Record<PipelineTarget['name'], string>;
