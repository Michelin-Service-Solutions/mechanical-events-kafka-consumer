import { MethodNotAllowed } from '@feathersjs/errors';
import type { HookContext } from '../declarations'


export const disallowExternal = (param: string) => {
    return async (context: HookContext) => {

        const allow = context.app.get("allowExternal");

        if (!allow.includes(context.path) && context.params.provider == param) throw new MethodNotAllowed();
    }
}
