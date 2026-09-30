import { ISecurityGroup, IVpc, SecurityGroup, Subnet, Vpc, VpcAttributes } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

// ADD VPC AND SECURITY GROUP IMPORTS HERE
// Lambdas need to be in a VPC if they need to access VPC-protected resources (e.g. MySQL DB clusters, Redis cache).

export function importVPC(scope: Construct, attributes: VpcAttributes): IVpc {
  return Vpc.fromVpcAttributes(scope, 'VPC', attributes);
}

export function importSecurityGroup(scope: Construct, securityGroupId: string): ISecurityGroup {
  return SecurityGroup.fromSecurityGroupId(scope, `SecurityGroup-${securityGroupId}`, securityGroupId,{allowAllOutbound:true});
}

export function importSubnets(scope: Construct, ids : string[] | undefined){  
 return  ids?.map((subnet, index) => Subnet.fromSubnetId(scope, `subnet-${subnet}`, subnet));
}
