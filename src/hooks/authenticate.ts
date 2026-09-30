// For more information about this file see https://dove.feathersjs.com/guides/cli/hook.html
import { NotAuthenticated } from "@feathersjs/errors";
import type { Application, HookContext } from "../declarations";
import { centralHelperPath } from "src/helpers/central";
import { redisClientPath } from "src/redis";

export enum AutenticatedUserRole {
    User = 10,
    App = 20,
}

export const getProfile = async (
    entity: AutenticatedUserRole,
    token: string,
    app: Application
) => {
    const redisHelper = app.get(redisClientPath);

    const stringlifiedProfile = await redisHelper.get(token);
    let profile;

    if (!stringlifiedProfile) {
        let expiration = 10;
        const centralHelper = app.get(centralHelperPath);
        if (entity === AutenticatedUserRole.User) {
            profile = await centralHelper.getCurrentUserProfileData(token);
        } else {
            profile = await centralHelper.getApplicationData(token);
            expiration = 120;
        }
        if (!profile) {
            throw new NotAuthenticated();
        }
        redisHelper.set(token, JSON.stringify(profile), expiration);
    } else {
        profile = JSON.parse(stringlifiedProfile);
    }
    return profile;
};

type Operation = "read" | "create" | "update" | "delete";
const getOperationFromContext = (context: HookContext): Operation | null => {
    switch (context.method) {
        case "find":
            return "read";
        case "get":
            return "read";
        case "create":
            return "create";
        case "update":
            return "update";
        case "patch":
            return "update";
        case "remove":
            return "delete";
        default:
            return null;
    }
};

export const authenticate = async (context: HookContext) => {
    if (!context.params.provider) return; // avoid double auth for internal calls
    if (context.service.allowAnonymous) return;
    const bearerParam = context.params.query?.authorization;
    delete context.params.query?.authorization;

    //  console.log('params', JSON.stringify(context.params));
    //  console.log('query', JSON.stringify(context.params.query));
    // console.log('headers', JSON.stringify(context.params.headers));
    // console.log('context data', JSON.stringify(context.data));

    const token: string = context.params.headers
        ? context.params.headers.authorization ||
          context.params.headers.Authorization ||
          null
        : bearerParam ?? null;
    console.log("Token", token);

    if (!token) throw new NotAuthenticated();

    const pattern = token.toLowerCase().startsWith("bearer")
        ? "bearer "
        : "x-auth ";
    const entity =
        pattern === "bearer "
            ? AutenticatedUserRole.User
            : AutenticatedUserRole.App;

    const tokenValue = token ? token.split(" ")[1] : null;
    if (!tokenValue) throw new NotAuthenticated();

    const profile = await getProfile(entity, tokenValue, context.app); //it trigger exception if token is invalid

    let permissions = [];
    if (entity == AutenticatedUserRole.User) {
        throw new NotAuthenticated(); //not allowing users

        // const grant = profile?.grants.find((i: { id: any }) => i.id == tenantId);
        //  permissions = grant?.role.permissions;

        context.currentUser = profile;
        context.currentUserAuth0Id = profile.uid;
        context.params.user = profile;
        //context.dealerLocations = grant?.locations.flatMap((location: any) => location.locations);
    } else if (entity == AutenticatedUserRole.App) {
        //permissions = profile?.permissions;
    }

    /*
    we wont validate permission for now
    
      const serviceRequested = context.service.serviceRequested ?? getServiceRequested(context.path);
      const operation = getOperationFromContext(context);
    
      if (!serviceRequested || !operation || !permissions?.[serviceRequested]?.[operation]) {
        console.log('serviceRequested', serviceRequested);
        console.log('permissions', permissions);
        console.log('operation', operation);
        throw new NotAuthenticated();
      }
    */

    return context;
};

const getServiceRequested = (path: string) => {
    switch (path) {
    
    }
    return "service-name";
};
