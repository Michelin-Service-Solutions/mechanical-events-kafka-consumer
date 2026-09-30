// For more information about this file see https://dove.feathersjs.com/guides/cli/hook.html
import type { HookContext } from '../declarations'

export const logInput = async (context: HookContext) => {

  const service = `${context.type} ${context.path}`;
  const integration = '';
  const identifier = context.id?.toString();
  const user = context.token ?? '';
  const headers = context.params.headers;


  // Log audit.


  return context;
}
