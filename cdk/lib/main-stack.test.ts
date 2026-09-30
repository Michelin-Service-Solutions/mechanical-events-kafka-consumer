import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { emptyEnv } from './components/common';
import { MainStack } from './main-stack';

describe('Main stack', () => {
  it('Should have the example lambda', () => {
    const app: App = new App();
    const stack: MainStack = new MainStack(app, `MainStk-${emptyEnv.appName}-${emptyEnv.environment}`, {
      myEnv: emptyEnv,
    });
    const template: Template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: `${emptyEnv.appName}-${emptyEnv.environment}-ExampleLambda`,
      Handler: 'lambda.handler',
      Runtime: 'nodejs18.x',
    });
  });
});
