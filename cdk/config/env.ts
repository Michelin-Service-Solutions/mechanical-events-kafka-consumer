import { MyEnv } from './interface'

const configuredEnvironment = process.env.DEPLOY_ENV ?? 'integration';
const environmentAliases: Record<string, string> = {
	development: 'integration',
	dev: 'integration',
	test: 'testing',
};

// Exporting `const` here instead of `let` does not work
// eslint-disable-next-line import/no-mutable-exports, prefer-const
export let env: string = environmentAliases[configuredEnvironment] ?? configuredEnvironment;

if (!['integration', 'testing', 'staging', 'production', 'local'].includes(env)) {
	throw new Error(`Unsupported DEPLOY_ENV "${configuredEnvironment}"`);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require, import/no-dynamic-require
export const myEnv: MyEnv = require(`./env_${env}`).environment;
