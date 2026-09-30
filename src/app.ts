// For more information about this file see https://dove.feathersjs.com/guides/cli/application.html
import { feathers } from '@feathersjs/feathers'
import express, {
    rest,
    json,
    urlencoded,
    cors,
    serveStatic,
    notFound,
    errorHandler
} from '@feathersjs/express'
import configuration from '@feathersjs/configuration'
import socketio from '@feathersjs/socketio'

import type { Application } from './declarations'

import { logger } from './logger'
import { logError } from './hooks/log-error'
import { services } from './services/index'
import { channels } from './channels'
import { configure_after, configure_before } from './configurations';
import { logInput } from './hooks/log-input'
import { authenticate } from './hooks/authenticate'


const app: Application = express(feathers());

// Load app configuration
//app.configure(configuration(configurationValidator))
app.configure(configuration());
configure_before(app);

app.use(cors())
app.use(json())
app.use(urlencoded({ extended: true }))
// Host the public folder
app.use('/', serveStatic(app.get('public')))

// Configure services and real-time functionality
app.configure(rest())
app.configure(
    socketio({
        cors: {
            origin: app.get('origins')
        }
    })
)

app.configure(services)
app.configure(channels)
configure_after(app);

// Configure a middleware for 404s and the error handler
app.use(notFound())
app.use(errorHandler({ logger }))

// Register hooks that run on all service methods
app.hooks({
    around: {
        all: [logError]
    },
    before: {
        all: [logInput, authenticate]
    },
    after: {
        all: [logInput]
    },
    error: {
        all: [logInput]
    }
})
// Register application setup and teardown hooks here
app.hooks({
    setup: [],
    teardown: []
})


export { app }
