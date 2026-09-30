// For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve, getValidator, querySyntax } from '@feathersjs/schema'
import type { FromSchema } from '@feathersjs/schema'

import type { HookContext } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { retryFromQueueService } from './retry-from-queue.class'

// Main data model schema
export const retryFromQueueSchema = {
  $id: 'retryFromQueue',
  type: 'object',
  additionalProperties: false,
  //required: ['caseNumber'],
  properties: {
    //caseNumber: { type: 'string' },
  }
} as const
export type retryFromQueue = FromSchema<typeof retryFromQueueSchema>
export const retryFromQueueValidator = getValidator(retryFromQueueSchema, dataValidator)
export const retryFromQueueResolver = resolve<retryFromQueue, HookContext<retryFromQueueService>>({})

export const retryFromQueueExternalResolver = resolve<retryFromQueue, HookContext<retryFromQueueService>>({})

// Schema for creating new data
export const retryFromQueueDataSchema = {
  $id: 'retryFromQueueData',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...retryFromQueueSchema.properties
  }
} as const
export type retryFromQueueData = FromSchema<typeof retryFromQueueDataSchema>
export const retryFromQueueDataValidator = getValidator(retryFromQueueDataSchema, dataValidator)
export const retryFromQueueDataResolver = resolve<retryFromQueueData, HookContext<retryFromQueueService>>({})

// Schema for updating existing data
export const retryFromQueuePatchSchema = {
  $id: 'retryFromQueuePatch',
  type: 'object',
  additionalProperties: false,
  required: [],
  properties: {
    ...retryFromQueueSchema.properties
  }
} as const
export type retryFromQueuePatch = FromSchema<typeof retryFromQueuePatchSchema>
export const retryFromQueuePatchValidator = getValidator(retryFromQueuePatchSchema, dataValidator)
export const retryFromQueuePatchResolver = resolve<retryFromQueuePatch, HookContext<retryFromQueueService>>({})

// Schema for allowed query properties
export const retryFromQueueQuerySchema = {
  $id: 'retryFromQueueQuery',
  type: 'object',
  additionalProperties: false,
  properties: {
    ...querySyntax(retryFromQueueSchema.properties)
  }
} as const
export type retryFromQueueQuery = FromSchema<typeof retryFromQueueQuerySchema>
export const retryFromQueueQueryValidator = getValidator(retryFromQueueQuerySchema, queryValidator)
export const retryFromQueueQueryResolver = resolve<retryFromQueueQuery, HookContext<retryFromQueueService>>({})
