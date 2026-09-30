import { ArnPrincipal, Effect, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { deploymentRoleNames, PipelineTarget } from '../config/pipeline';

export class DeploymentRoleStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps & { target: PipelineTarget['name'] }) {
    super(scope, id, props);
    const pipelineRoleArn = process.env.SHARED_PIPELINE_ROLE_ARN;
    if (!pipelineRoleArn) throw new Error('SHARED_PIPELINE_ROLE_ARN is required');

    const role = new Role(this, 'DeploymentRole', {
      roleName: deploymentRoleNames[props.target],
      assumedBy: new ArnPrincipal(pipelineRoleArn),
    });
    role.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['*'],
      actions: [
        'cloudformation:*', 'ec2:Describe*', 'ecs:*', 'elasticloadbalancing:Describe*',
        'elasticloadbalancing:CreateListenerRule', 'elasticloadbalancing:ModifyListenerRule',
        'elasticloadbalancing:DeleteRule', 'elasticloadbalancing:ModifyTargetGroup',
        'logs:*', 'iam:GetRole', 'iam:PassRole', 'ssm:GetParameter', 'ssm:GetParameters',
        'secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue', 'sqs:*',
      ],
    }));
    role.addToPolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ecr:BatchCheckLayerAvailability', 'ecr:BatchGetImage', 'ecr:GetDownloadUrlForLayer'],
      resources: [`arn:aws:ecr:us-east-1:${process.env.SHARED_AWS_ACCOUNT_ID ?? '024972153933'}:repository/misp/mechanical-events-kafka-consumer`],
    }));
    new CfnOutput(this, 'DeploymentRoleArn', { value: role.roleArn });
  }
}
