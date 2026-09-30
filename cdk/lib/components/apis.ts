import { Cors, IdentitySource, MethodLoggingLevel, RequestAuthorizer, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { AssetCode, Function, FunctionProps } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

// ADD APIS HERE

export function createAPI(scope: Construct, appName: string, environment: string) {
  return new RestApi(scope, 'API', {
    description: 'Main API for the backend',
    deployOptions: {
      stageName: 'single', // Since we always have a single stage for each API, we don't need to name them after the environment.
      loggingLevel: MethodLoggingLevel.ERROR,
      variables: {
        env: environment,
      },
    },
    defaultCorsPreflightOptions: {
      // Avoiding CORS issues. The API should be secure enough with the API key or authorizer authentication.
      allowMethods: Cors.ALL_METHODS,
      allowOrigins: Cors.ALL_ORIGINS,
      allowHeaders: ['*'],
    },
    restApiName: `${appName}-${environment}`,
  });
}

export function createAuthorizer(
  scope: Construct,
  defaultLambdaProps: FunctionProps,
  appName: string,
  envName: string,
  environment: { [key: string]: string },
): RequestAuthorizer {
  const authorizerLambda = new Function(scope, 'Authorizer-Lambda', {
    ...defaultLambdaProps,
    functionName: `${appName}-${envName}-Authorizer-Lambda`,
    code: new AssetCode('node_modules/@michelin/authorizer-users-apps'),
    handler: 'index.handler',
    environment,
  });

  return new RequestAuthorizer(scope, 'Authorizer', {
    handler: authorizerLambda,
    identitySources: [IdentitySource.header('Authorization')],
  });
}
