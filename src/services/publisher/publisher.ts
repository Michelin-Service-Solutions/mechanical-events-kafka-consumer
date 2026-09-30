// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html

import { hooks as schemaHooks } from '@feathersjs/schema'

import {
  publisherDataValidator,
  publisherResolver,
  publisherExternalResolver,
  publisherDataResolver,
} from './publisher.schema'

import type { Application } from '../../declarations'
import { PublisherService, getOptions } from './publisher.class'
import { disallowExternal } from 'src/hooks/disallow'

export const publisherPath = 'publisher'
export const publisherMethods = ['create'] as const

export * from './publisher.class'
export * from './publisher.schema'

// A configure function that registers the service and its hooks via `app.configure`
export const publisher = (app: Application) => {
  // Register our service on the Feathers application
  app.use(publisherPath, new PublisherService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: publisherMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(publisherPath).hooks({
    around: {
      all: [
        schemaHooks.resolveExternal(publisherExternalResolver),
        schemaHooks.resolveResult(publisherResolver)
      ]
    },
    before: {
      all: [disallowExternal('rest')],    
      create: [//if we validate schema , and oncall change that, it will fail. so, no schema is the right option 
    //    schemaHooks.validateData(publisherDataValidator),
   //     schemaHooks.resolveData(publisherDataResolver)
      ]   
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
    [publisherPath]: PublisherService
  }
}
