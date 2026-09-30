// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { Params, ServiceInterface } from '@feathersjs/feathers'
import type { Application } from '../../../declarations'

import { OnCallUpdateCase } from 'src/helpers/interfaces/message-declarations-ers';
import { CaseErsSchema, publisherPath } from 'src/services/publisher/publisher';
import { DataSourceErs } from 'src/helpers/data-source-ers';

export enum EventType {
  ERS = 'ERS',  
}

export interface EventServiceOptions {
  app: Application
}

export interface EventParams extends Params<any> {
  type?: EventType
 }

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class EventService<ServiceParams extends EventParams = EventParams>
  implements ServiceInterface<any, any, ServiceParams, any> {
  app: Application;

  constructor(public options: EventServiceOptions) {
    this.app = options.app;
  }

  async create(data: OnCallUpdateCase, _params?: ServiceParams): Promise<boolean> {

    let completeEvent = null;
    
    const ersEvent = data as OnCallUpdateCase;
    console.log('Processing OnCallUpdateCase with case_number:', ersEvent.case_number);

      completeEvent = await DataSourceErs.getOnCallCase(data);

    if (completeEvent) {
      await this.publishEvent(completeEvent);
    }

    return true;
  }

  async publishEvent(data: CaseErsSchema): Promise<void> {
    await this.app.service(publisherPath).create({
      data : JSON.parse(JSON.stringify(data)) ,      //Ensure primitive properties are string
    });
  }

}

export const getOptions = (app: Application) => {
  return { app }
}