// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html
import { feathers } from '@feathersjs/feathers'
import express, {
    rest,
    json,
    urlencoded,
    notFound,
    errorHandler
} from '@feathersjs/express'
import configuration from '@feathersjs/configuration'

import type { Application } from './declarations'

import { logger } from './logger'
import { logError } from './hooks/log-error'
import { services } from './services/index'
import { configure_after } from './configurations';

const app: Application = express(feathers());

app.configure(configuration());

app.use(json())
app.use(urlencoded({ extended: true }))

app.configure(rest())
app.configure(services)
configure_after(app);

app.use(notFound())
app.use(errorHandler({ logger }))

app.hooks({
    around: {
        all: [logError]
    }
})

export { app }
