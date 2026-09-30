import type { StackProps } from 'aws-cdk-lib';
import type { ECSPipelineEnv, MyEnv } from '../../config/interface';

export interface MainStackProps extends StackProps {
  myEnv: MyEnv;
}
export interface SecondaryStackProps extends StackProps {
  readonly myEnv: MyEnv;
}

export interface PipelineStackProps extends StackProps {
  readonly myEnv: ECSPipelineEnv;
}

export interface HistoricalCasesStackProps extends StackProps {
  readonly myEnv: MyEnv;
  readonly auditsBusARN: string;
}
