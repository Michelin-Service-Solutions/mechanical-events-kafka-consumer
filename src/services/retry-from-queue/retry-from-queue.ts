// @t s - nocheck
// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  retryFromQueueDataValidator,
  retryFromQueuePatchValidator,
  retryFromQueueQueryValidator,
  retryFromQueueResolver,
  retryFromQueueExternalResolver,
  retryFromQueueDataResolver,
  retryFromQueuePatchResolver,
  retryFromQueueQueryResolver
} from './retry-from-queue.schema'

import type { Application } from '../../declarations'
import { retryFromQueueService, getOptions } from './retry-from-queue.class'
import { disallowExternal } from 'src/hooks/disallow'

export const retryFromQueuePath =  'retry-from-queue';
export const retryFromQueueMethods = ['find', 'get', 'create', 'patch', 'remove'] as const

export * from './retry-from-queue.class'
export * from './retry-from-queue.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const retryFromQueue = (app: Application) => {
  // Register our service on the Feathers application
   // @ts-ignore: mato
  app.use(retryFromQueuePath, new retryFromQueueService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: retryFromQueueMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
   // @ts-ignore: mato
  app.service(retryFromQueuePath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(retryFromQueueExternalResolver),
        schemaHooks.resolveResult(retryFromQueueResolver)
      ]
    },
    before: {
      all: [
        disallowExternal('rest'),
        schemaHooks.validateQuery(retryFromQueueQueryValidator),
        schemaHooks.resolveQuery(retryFromQueueQueryResolver)
      ],
      find: [],
      get: [],
      create: [
        schemaHooks.validateData(retryFromQueueDataValidator),
        schemaHooks.resolveData(retryFromQueueDataResolver)
      ],
      patch: [
        schemaHooks.validateData(retryFromQueuePatchValidator),
        schemaHooks.resolveData(retryFromQueuePatchResolver)
      ],
      remove: []
    },
    after: {
      all: []
    },
    error: {
      all: []
    }
  })
}

// Add this service to the service type index
declare module '../../declarations' {
  interface ServiceTypes {
  
    [retryFromQueuePath]: retryFromQueueService
  }
}
