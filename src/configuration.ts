import { Type, getValidator, defaultAppConfiguration } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import { dataValidator } from './validators'

export const configurationSchema = Type.Intersect([
  defaultAppConfiguration,
  Type.Object({
    host: Type.String(),
    port: Type.Number(),
    public: Type.String(),
    baseURL: Type.String(),
    environment: Type.String(),
    kafka: Type.Object({
      arn: Type.String(),
      encryptionKey: Type.String(),
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
      producer: Type.Object({
        topic: Type.String(),
      }),
    }),
    oncallDB: Type.Object({
      client: Type.String(),
      connection: Type.Object({
        host: Type.String(),
        port: Type.Number(),
        user: Type.String(),
        password: Type.String(),
        database: Type.String(),
      })
    }),
    appName: Type.String(),
    redis: Type.Object({
      host: Type.String(),
      prefix: Type.String(),
      tokenPrefix: Type.String(),
    }),

    appToken: Type.String(),
    mtvaSystemUserEmail: Type.Optional(Type.String()),
    centralHost: Type.String(),
    allowExternal: Type.Array(Type.String()),
    auditRetentionDays: Type.Number(),
    maxRetries: Type.Number(),
    middleware: Type.Object({
      url: Type.String(),
      username: Type.String(),
      password: Type.String(),
    }),
    elasticSearchUrl: Type.String(),
    emailNotificationUrl: Type.String(),
    dryRun: Type.Boolean(),
    surveyUrl: Type.String(),
  })
])

export type ApplicationConfiguration = Static<typeof configurationSchema>

export const configurationValidator = getValidator(configurationSchema, dataValidator)
