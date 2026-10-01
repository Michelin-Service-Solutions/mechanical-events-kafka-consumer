import { ListenerNextAvailablePriority } from "@michelin/cdk-listener-next-priority";
import { Duration, Fn, RemovalPolicy } from "aws-cdk-lib";
import { ISecurityGroup, ISubnet, IVpc, Peer, Port } from "aws-cdk-lib/aws-ec2";

import { Cluster, Compatibility, ContainerImage, FargateService, ICluster, LogDriver, NetworkMode, TaskDefinition, Secret } from "aws-cdk-lib/aws-ecs";
import { ApplicationListener, ApplicationListenerRule, ApplicationProtocol, ApplicationTargetGroup, ListenerAction, ListenerCondition, Protocol, TargetType } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { RetentionDays, LogGroup } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";



export function createECS( scope: Construct,appName: string,envName: string,vpc: IVpc,securityGroups: ISecurityGroup[],subnets:ISubnet[] | undefined ,clusterName:string,account:string,region:string,loadBalancerArn:string,imageRegistryAccount:string,ecsEnvironment:{[key:string]:string},ecsSecrets:{[key:string]:Secret},imgVersionTag:string){

  
  // Import ECS cluster
  const cluster: ICluster = Cluster.fromClusterAttributes(scope, clusterName, {
     clusterArn: `arn:aws:ecs:${region}:${account}:cluster/${clusterName}`,
     clusterName: clusterName,
     vpc,
     securityGroups,
   });
 
  const taskDefinition=createTaskDefinition(scope,appName,envName,imageRegistryAccount,ecsEnvironment,ecsSecrets,imgVersionTag);
  

  // The ECS Service used for deploying tasks
  const service = new FargateService(scope, `service`, {
    cluster,
    desiredCount: 1,
    taskDefinition,
    securityGroups,
    assignPublicIp: false,
    healthCheckGracePeriod: Duration.seconds(180),
    enableExecuteCommand: true,
    circuitBreaker: { enable: true, rollback: true },
    vpcSubnets: { subnets },
    serviceName: `${appName}-service`,
  });


  const targetGroupHttp = createTargetGroup( scope,appName,vpc,loadBalancerArn);
  // add to a target group so make containers discoverable by the application load balancer
  service.attachToApplicationTargetGroup(targetGroupHttp);

  return service;
  }

function createTargetGroup( scope: Construct,appName: string,vpc: IVpc,loadBalancerArn:string){

  // Listener from existing arns
  const loadBalancerListener = ApplicationListener.fromLookup(scope, 'SharedListener', {
    loadBalancerArn: loadBalancerArn,
    listenerPort: 443
  });

  loadBalancerListener.connections.securityGroups.forEach(sg => { sg.addEgressRule(Peer.anyIpv4(), Port.allTraffic(), " avoiding delete alltraficc rule") });

  // Target group to make resources containers dicoverable by the application load balencer
  const targetGroupHttp = new ApplicationTargetGroup(
    scope,
    `target-group`,
    {
      port: 3030,
      vpc,
      protocol: ApplicationProtocol.HTTP,
      targetType: TargetType.IP,
      healthCheck: {
        path: `/${appName}/healthcheck`,
        protocol: Protocol.HTTP,
        interval: Duration.seconds(45),
        timeout: Duration.seconds(40),
        healthyThresholdCount: 4,
        unhealthyThresholdCount: 4,
      },
    },
  );

  const construct = new ListenerNextAvailablePriority(scope, 'MyPriority', {
    listener: loadBalancerListener,
  });

  new ApplicationListenerRule(scope, 'MyNewApplicationListenerRule', {
    priority: construct.nextPriority,
    listener: loadBalancerListener,
    conditions: [ListenerCondition.pathPatterns([`/${appName}*`])],
    action: ListenerAction.forward([targetGroupHttp]),
  });

  return targetGroupHttp;
}


function createTaskDefinition(scope: Construct,appName: string,envName: string,imageRegistryAccount:string,ecsEnvironment:{[key:string]:string},ecsSecrets:{[key:string]:Secret},imgVersionTag:string){

// Create a Fargate container image
const image = ContainerImage.fromRegistry(`${imageRegistryAccount}.dkr.ecr.us-east-1.amazonaws.com/misp/${appName.toLowerCase()}:${imgVersionTag}`);


const dlqQueueARN = Fn.importValue(`${appName}-dlqQueue-${envName}-ARN`);
const retryQueueARN = Fn.importValue(`${appName}-retryQueue-${envName}-ARN`);

  const policies = new PolicyDocument({
    statements: [
      new PolicyStatement(
        {
          effect: Effect.ALLOW,
          resources: ['*'],
          actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret']
        }
      ),
      new PolicyStatement({ effect: Effect.ALLOW, resources: ['*'], actions: ['events:PutEvents'] }),
      new PolicyStatement({ effect: Effect.ALLOW, resources: ['*'], actions: ['ses:SendEmail', 'ses:SendRawEmail'] }),
      new PolicyStatement({
        effect: Effect.ALLOW, resources: [retryQueueARN, dlqQueueARN], actions: [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage"
        ]
      }),
      new PolicyStatement(
        {
          actions: ['ssm:GetParameters'],
          resources: ['*'],
        }),
      new PolicyStatement({
        effect: Effect.ALLOW, resources: ['*'], actions: [
          "kms:Decrypt",
          "kms:DescribeKey",
          "kms:Encrypt",
				  "kms:GenerateDataKey",
          "kms:CreateGrant"
        ],
      }),
       new PolicyStatement({
        effect: Effect.ALLOW, resources: ['*'], actions: [          
          "secretsmanager:CreateSecret"          
        ],
      })
      ,
       new PolicyStatement({
        effect: Effect.ALLOW, resources: ['*'], actions: [
           "kafka:BatchAssociateScramSecret",            
        ],
      })
       
    ]
  })

  const taskRole = new Role(scope, `taskRole`, {
    assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
    roleName: `${appName}-${envName}-Role`,
    managedPolicies: [
      ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSReadOnlyAccess')
    ],
    inlinePolicies: {
      [`${appName}-${envName}-Policy`]: policies
    }
  });



  const taskDefinition = new TaskDefinition(scope, `task`, {
    family: `${appName}-${envName}`,
    compatibility: Compatibility.FARGATE,
    cpu: '1024',
    memoryMiB: '2048',
    networkMode: NetworkMode.AWS_VPC,
    taskRole,
    executionRole: taskRole,
  });

    // The docker container including the image to use
    taskDefinition.addContainer(`container`, {
      image,
      environment: ecsEnvironment,
      secrets:ecsSecrets,
      // store the logs in cloudwatch
      logging: LogDriver.awsLogs({ streamPrefix: `${appName}-api-logs`, logGroup: new LogGroup(scope, 'Log Group',{logGroupName: `${appName}-${envName}-logs`,retention:RetentionDays.ONE_MONTH,removalPolicy:RemovalPolicy.DESTROY})}),
      portMappings: [
        {
          containerPort: 3030,
        },
      ],
    });


    return taskDefinition;
}