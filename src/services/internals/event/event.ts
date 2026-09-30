// For more information about this file see https://dove.feathersjs.com/guides/cli/service.html
import { disallowExternal } from 'src/hooks/disallow'
import type { Application } from '../../../declarations'
import { EventService, getOptions } from './event.class'
import { disallow } from "feathers-hooks-common"

export const eventPath = 'event'
export const eventMethods = ['create'] as const

export * from './event.class'

// A configure function that registers the service and its hooks via `app.configure`
export const event = (app: Application) => {
  // Register our service on the Feathers application
  app.use(eventPath, new EventService(getOptions(app)), {
    // A list of all methods this service exposes externally
    methods: eventMethods,
    // You can add additional custom events to be sent to clients here
    events: []
  })
  // Initialize hooks
  app.service(eventPath).hooks({
    around: {
      all: []
    },
    before: {
      all: [disallowExternal('rest')],
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
declare module '../../../declarations' {
  interface ServiceTypes {
    [eventPath]: EventService
  }
}
