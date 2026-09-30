import { ITable } from 'aws-cdk-lib/aws-dynamodb';
import { Function, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

// This rule mistakes the AWS lambda 'Function' class with the JS 'Function' interface: https://typescript-eslint.io/rules/ban-types/
/* eslint-disable @typescript-eslint/ban-types */

// ADD FEEDERS HERE

export function createExampleDDBToESFeeder(esFeeder: Function, dynamoDBTable: ITable) {
  esFeeder.addEventSource(
    new DynamoEventSource(dynamoDBTable, {
      startingPosition: StartingPosition.LATEST,
    }),
  );
}
