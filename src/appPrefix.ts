// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html
import { feathers } from '@feathersjs/feathers'
import express, {
  rest,
  notFound,
  errorHandler
} from '@feathersjs/express'
import configuration from '@feathersjs/configuration'


import type { Application } from './declarations'
import { logger } from './logger'
import { app as api } from './app'


const app: Application = express(feathers())
// Load app configuration
app.configure(configuration())
app.configure(rest())
//app.use(notFound())
app.use(errorHandler({ logger }))
app.use("/" + app.get('appName'), api as any)
export { app }
