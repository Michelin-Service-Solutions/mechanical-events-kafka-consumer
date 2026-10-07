import { Type, getValidator, defaultAppConfiguration } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import { dataValidator } from './validators'

export const configurationSchema = Type.Intersect([
  defaultAppConfiguration,
  Type.Object({
    host: Type.String(),
    port: Type.Number(),
    kafka: Type.Object({
      connection: Type.Object({
        brokers: Type.Array(Type.String()),
        ssl: Type.Literal(true),
        sasl: Type.Object({
          username: Type.String(),
          password: Type.String(),
          mechanism: Type.Literal('scram-sha-512'),
        })
      }),
      consumer: Type.Object({
        groupId: Type.String(),
        topics: Type.Array(Type.String()),
        fromBeginning: Type.Boolean(),
      }),
    }),
    appName: Type.String(),
    redis: Type.Object({
      host: Type.String(),
      prefix: Type.String(),
    }),

    appToken: Type.String(),
    allowExternal: Type.Array(Type.String()),
    maxRetries: Type.Number(),
    elasticSearchUrl: Type.String(),
    emailNotificationUrl: Type.String(),
    dryRun: Type.Boolean(),
    surveyUrl: Type.String(),
  })
])

export type ApplicationConfiguration = Static<typeof configurationSchema>

export const configurationValidator = getValidator(configurationSchema, dataValidator)
