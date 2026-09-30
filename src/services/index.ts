import { publisher } from './publisher/publisher'
import { event } from './internals/event/event'
import { retryFromQueue } from './retry-from-queue/retry-from-queue'
// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html#configure-functions
import type { Application } from '../declarations'

export const services = (app: Application) => {
  app.configure(publisher)
  app.configure(event)
  app.configure(retryFromQueue)
  // All services will be registered here
}
