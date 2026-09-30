import { SecretValue, Stack } from 'aws-cdk-lib';
import { Artifact, Pipeline, PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import { CodeBuildAction, GitHubSourceAction, GitHubTrigger, ManualApprovalAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { BuildEnvironmentVariableType, BuildSpec, LinuxBuildImage, Project } from 'aws-cdk-lib/aws-codebuild';
import { AccountPrincipal, Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { sharedPipelineConfig, sharedPipelineRoleName } from '../config/pipeline';

export class SharedPipelineStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id, { env: { account: sharedPipelineConfig.sharedAccount, region: sharedPipelineConfig.region } });

    const role = new Role(this, 'PipelineRole', {
      roleName: sharedPipelineRoleName,
      assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
    });
    role.addToPolicy(new PolicyStatement({ effect: Effect.ALLOW, resources: ['*'], actions: ['s3:*', 'logs:*', 'sts:AssumeRole', 'secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret', 'ecr:*'] }));

    const npmToken = Secret.fromSecretNameV2(this, 'NpmToken', 'misp-c3ps-aggregator-npm-token');
    npmToken.grantRead(role);
    const artifacts = new Bucket(this, 'Artifacts', { bucketName: `mechanical-events-kafka-consumer-pipeline-${sharedPipelineConfig.sharedAccount}`, encryption: BucketEncryption.KMS_MANAGED, blockPublicAccess: BlockPublicAccess.BLOCK_ALL, versioned: true });
    const repository = new Repository(this, 'ImageRepository', { repositoryName: 'misp/mechanical-events-kafka-consumer', imageScanOnPush: true });
    repository.addToResourcePolicy(new PolicyStatement({ effect: Effect.ALLOW, principals: sharedPipelineConfig.targets.map((target) => new AccountPrincipal(target.account)), actions: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'] }));

    const source = new Artifact('Source');
    const image = new Artifact('Image');
    const pipeline = new Pipeline(this, 'Pipeline', { pipelineName: 'mechanical-events-kafka-consumer-promotion', pipelineType: PipelineType.V2, artifactBucket: artifacts, restartExecutionOnUpdate: true });
    pipeline.addStage({ stageName: 'Source', actions: [new GitHubSourceAction({ actionName: 'GitHub', owner: sharedPipelineConfig.repositoryOwner, repo: sharedPipelineConfig.repositoryName, branch: sharedPipelineConfig.sourceBranch, oauthToken: SecretValue.secretsManager('misp-mechanical-events-kafka-consumer-github-token'), output: source, trigger: GitHubTrigger.WEBHOOK })] });

    const build = new Project(this, 'Build', {
      projectName: 'mechanical-events-kafka-consumer-image-build', role,
      environment: { buildImage: LinuxBuildImage.STANDARD_7_0, privileged: true, environmentVariables: { SHARED_ACCOUNT_ID: { value: sharedPipelineConfig.sharedAccount, type: BuildEnvironmentVariableType.PLAINTEXT }, AWS_DEFAULT_REGION: { value: sharedPipelineConfig.region, type: BuildEnvironmentVariableType.PLAINTEXT } } },
      buildSpec: BuildSpec.fromObject({ version: '0.2', env: { 'secrets-manager': { NPM_TOKEN: npmToken.secretArn } }, phases: { install: { 'runtime-versions': { nodejs: '22' }, commands: ['printf "@michelin:registry=https://registry.npmjs.org/\\n//registry.npmjs.org/:_authToken=%s\\n" "$NPM_TOKEN" > ~/.npmrc', 'npm ci'] }, pre_build: { commands: ['export IMAGE_TAG=$(printf "%s" "$CODEBUILD_RESOLVED_SOURCE_VERSION" | cut -c1-12)', 'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $SHARED_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com'] }, build: { commands: ['npm run build', 'docker build -t $SHARED_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/misp/mechanical-events-kafka-consumer:$IMAGE_TAG .', 'docker push $SHARED_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/misp/mechanical-events-kafka-consumer:$IMAGE_TAG', 'printf "IMAGE_TAG=%s\\n" "$IMAGE_TAG" > image.env'] }, post_build: { commands: ['rm -f ~/.npmrc'] } }, artifacts: { files: ['image.env'] } }),
    });
    pipeline.addStage({ stageName: 'Build', actions: [new CodeBuildAction({ actionName: 'BuildImage', project: build, input: source, outputs: [image] })] });

    sharedPipelineConfig.targets.forEach((target) => {
      if (target.approvalRequired) pipeline.addStage({ stageName: `${target.name}Approval`, actions: [new ManualApprovalAction({ actionName: `Approve${target.name}` })] });
      const deploy = new Project(this, `${target.name}Deploy`, {
        projectName: `mechanical-events-kafka-consumer-${target.name}-deploy`, role,
        environment: { buildImage: LinuxBuildImage.STANDARD_7_0, environmentVariables: { TARGET_ENV: { value: target.deployEnv, type: BuildEnvironmentVariableType.PLAINTEXT }, TARGET_ROLE_ARN: { value: target.roleArn, type: BuildEnvironmentVariableType.PLAINTEXT }, IMAGE_REGISTRY_ACCOUNT: { value: sharedPipelineConfig.sharedAccount, type: BuildEnvironmentVariableType.PLAINTEXT }, AWS_DEFAULT_REGION: { value: sharedPipelineConfig.region, type: BuildEnvironmentVariableType.PLAINTEXT } } },
        buildSpec: BuildSpec.fromObject({ version: '0.2', env: { 'secrets-manager': { NPM_TOKEN: npmToken.secretArn } }, phases: { install: { 'runtime-versions': { nodejs: '22' }, commands: ['printf "@michelin:registry=https://registry.npmjs.org/\\n//registry.npmjs.org/:_authToken=%s\\n" "$NPM_TOKEN" > ~/.npmrc', 'npm ci'] }, build: { commands: ['. "$CODEBUILD_SRC_DIR_Image/image.env"', 'ASSUMED=$(aws sts assume-role --role-arn "$TARGET_ROLE_ARN" --role-session-name "mechanical-events-$TARGET_ENV")', 'export AWS_ACCESS_KEY_ID=$(printf "%s" "$ASSUMED" | python -c "import json,sys; print(json.load(sys.stdin)[\"Credentials\"][\"AccessKeyId\"])" )', 'export AWS_SECRET_ACCESS_KEY=$(printf "%s" "$ASSUMED" | python -c "import json,sys; print(json.load(sys.stdin)[\"Credentials\"][\"SecretAccessKey\"])" )', 'export AWS_SESSION_TOKEN=$(printf "%s" "$ASSUMED" | python -c "import json,sys; print(json.load(sys.stdin)[\"Credentials\"][\"SessionToken\"])" )', 'export DEPLOY_ENV=$TARGET_ENV', 'export IMAGE_TAG=$IMAGE_TAG', 'export IMAGE_REGISTRY_ACCOUNT=$IMAGE_REGISTRY_ACCOUNT', 'cd cdk && npm ci && npm run build && CDK_MODE=application npx cdk deploy mechanical-events-kafka-consumer-$TARGET_ENV-SecondaryStack mechanical-events-kafka-consumer-$TARGET_ENV-MainStack --require-approval never'] } } }),
      });
      deploy.addToRolePolicy(new PolicyStatement({ effect: Effect.ALLOW, resources: [target.roleArn], actions: ['sts:AssumeRole'] }));
      pipeline.addStage({ stageName: target.name, actions: [new CodeBuildAction({ actionName: `Deploy${target.name}`, project: deploy, input: source, extraInputs: [image] })] });
    });
  }
}
