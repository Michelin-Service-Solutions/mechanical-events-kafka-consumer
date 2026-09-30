// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#custom-services
import type { NullableId, Params, ServiceInterface } from '@feathersjs/feathers'

import type { Application } from '../../declarations'
import type {
  retryFromQueue,
  retryFromQueueData,
  retryFromQueuePatch,
  retryFromQueueQuery
} from './retry-from-queue.schema'
import { SQS } from 'aws-sdk'
import { RetryCaseData } from "../../helpers/interfaces/message-declarations-ers";

export type { retryFromQueue, retryFromQueueData, retryFromQueuePatch, retryFromQueueQuery }

export interface retryFromQueueServiceOptions {
  app: Application
  maxRetries: number
}

export interface retryFromQueueParams extends Params<retryFromQueueQuery> { }

enum QueueName {
  retry = "retry",
  dlq = "dlq",
}

// This is a skeleton for a custom service class. Remove or add the methods you need here
export class retryFromQueueService<ServiceParams extends retryFromQueueParams = retryFromQueueParams>
  implements ServiceInterface<retryFromQueue, retryFromQueueData, ServiceParams, retryFromQueuePatch> {
  constructor(public options: retryFromQueueServiceOptions) { }

  async find(_params?: ServiceParams): Promise<retryFromQueue> {
    return {
      case_number: 0
    }
  }

  async get(queue: QueueName, _params?: ServiceParams): Promise<retryFromQueue> {
    const sqs = this.options.app.get('sqsClient');

    const delays = {
      retry: 10,
      dlq: 0,
    }

    let logs: string[];
    let messages = await sqs.get(queue);
    let retriedMessages: RetryCaseData[] = [];

    for (const message of messages as SQS.Message[]) {
      logs = [];
      logs.push(`Received Message: ${message.Body}, Queue: ${queue}`);

      const messageObj: RetryCaseData = JSON.parse(message.Body!);
      const logsID = `RetryCase~${messageObj.case_number}`;
      const nextRetry = new Date(messageObj.nextRetry);

      if (nextRetry > new Date()) {
        logs.push(`Retry time not reached (${messageObj.nextRetry})`);
        console.log(JSON.stringify({
          id: logsID,
          queue,
          logs
        }));
        continue;
      }

      try {
        retriedMessages.push(messageObj);
        logs.push(`Retrying Mechanical ERS email: ${messageObj.case_number}`);
        await this.options.app.get('mechanicalEmailService').process(messageObj.caseData ?? messageObj);
      } catch (e) {
        logs.push(`Error case: ${messageObj.case_number}: ${e.message}`);

        messageObj.retryNumber++;
        const oldRetry = new Date(messageObj.nextRetry);
        const nextRetry = oldRetry.setSeconds(oldRetry.getSeconds() + delays[queue] * messageObj.retryNumber);
        messageObj.nextRetry = (new Date(nextRetry)).toISOString();

        const newQueue = (messageObj.retryNumber <= this.options.maxRetries) ? queue : QueueName.dlq
        logs.push(`Enqueue case ${messageObj.case_number} into ${newQueue}`);

        await sqs.create(messageObj, { queue: newQueue });
      } finally {
        await sqs.remove(message.ReceiptHandle!, queue);
      }

      console.log(JSON.stringify({
        id: logsID,
        queue,
        logs
      }));
    }

    return retriedMessages;
  }

  async create(data: retryFromQueueData, params?: ServiceParams): Promise<retryFromQueue>
  async create(data: retryFromQueueData[], params?: ServiceParams): Promise<retryFromQueue[]>
  async create(
    data: retryFromQueueData | retryFromQueueData[],
    params?: ServiceParams
  ): Promise<retryFromQueue | retryFromQueue[]> {
    if (Array.isArray(data)) {
      return Promise.all(data.map((current) => this.create(current, params)))
    }

    return {
      caseNumber: '0',
      ...data
    }
  }

  // This method has to be added to the 'methods' option to make it available to clients
  async update(id: NullableId, data: retryFromQueueData, _params?: ServiceParams): Promise<retryFromQueue> {
    return {
      caseNumber: '0',
      ...data
    }
  }

  async patch(id: NullableId, data: retryFromQueuePatch, _params?: ServiceParams): Promise<retryFromQueue> {
    return {
      caseNumber: '0',
      ...data
    }
  }

  async remove(id: NullableId, _params?: ServiceParams): Promise<retryFromQueue> {
    return {
      caseNumber: '0',
    }
  }
}

export const getOptions = (app: Application) => {
  const maxRetries = app.get('maxRetries') ?? 20;
  return { app, maxRetries }
}
