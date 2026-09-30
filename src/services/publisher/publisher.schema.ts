// // For more information about this file see https://dove.feathersjs.com/guides/cli/service.schemas.html
import { resolve } from '@feathersjs/schema'
import { Type, getValidator, querySyntax } from '@feathersjs/typebox'
import type { Static } from '@feathersjs/typebox'

import type { HookContext } from '../../declarations'
import { dataValidator, queryValidator } from '../../validators'
import type { PublisherService } from './publisher.class'
import { caseErsSchema } from './publisher.ers-schema'


export const publisherSchema = Type.Object(
  {
    data: caseErsSchema ,
  },

  { $id: 'Publisher', additionalProperties: false }
)

export type CaseErsSchema = Static<typeof caseErsSchema>


export type Publisher = Static<typeof publisherSchema>
export const publisherValidator = getValidator(publisherSchema, dataValidator)
export const publisherResolver = resolve<Publisher, HookContext<PublisherService>>({})

export const publisherExternalResolver = resolve<Publisher, HookContext<PublisherService>>({})

// Schema for creating new entries
export const publisherDataSchema = Type.Pick(publisherSchema, ['data'], {
  $id: 'PublisherData'
})


export type PublisherData = Static<typeof publisherDataSchema>
export const publisherDataValidator = getValidator(publisherDataSchema, dataValidator)
export const publisherDataResolver = resolve<Publisher, HookContext<PublisherService>>({})
