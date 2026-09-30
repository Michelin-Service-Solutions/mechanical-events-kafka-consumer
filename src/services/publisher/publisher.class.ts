// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Id, NullableId, Params, ServiceInterface } from '@feathersjs/feathers'

import type { Application } from '../../declarations'
import type {
  Publisher, PublisherData,
} from './publisher.schema'
import { KafkaManager } from 'src/helpers/services/kafka-manager'

export type {
  Publisher, PublisherData,

}

export interface PublisherServiceOptions {
  app: Application
  kafkaManagerService: KafkaManager,
  kafkaProducerTopic: string,
}

export interface PublisherParams { }

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class PublisherService<ServiceParams extends PublisherParams = PublisherParams>
  implements ServiceInterface<Publisher, PublisherData, ServiceParams

  > {
  constructor(public options: PublisherServiceOptions) { }

  async create(data: PublisherData, params?: ServiceParams): Promise<Publisher>
  async create(data: PublisherData[], params?: ServiceParams): Promise<Publisher[]>
  async create(
    data: PublisherData | PublisherData[],
    params?: ServiceParams
  ): Promise<Publisher | Publisher[]> {
    if (Array.isArray(data)) {
      return Promise.all(data.map((current) => this.create(current, params)))
    }
    console.log('Publishing event to Kafka topic:', this.options.kafkaProducerTopic, 'with data:', data);
    await this.options.kafkaManagerService.publishMessageOnTopic(this.options.kafkaProducerTopic, data.data);
    
    return data;
  }
}

export const getOptions = (app: Application) => {
  const { producer } = app.get('kafka')

  return {
    app,
    kafkaManagerService: app.get('KafkaManagerService'),
    kafkaProducerTopic: producer.topic,
  }
}
