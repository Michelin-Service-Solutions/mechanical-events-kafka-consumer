// For more information about this file see https://dove.feathersjs.com/guides/cli/databases.html
import knex from 'knex'
import type { Knex } from 'knex'
import type { Application } from '../../declarations'

declare module '../../declarations' {
  interface Configuration {
    oncallDBClient: Knex
  }
}

export const postgresql = (app: Application) => {
  const config = app.get('oncallDB')
  const db = knex(config!)

  app.set('oncallDBClient', db)
}
