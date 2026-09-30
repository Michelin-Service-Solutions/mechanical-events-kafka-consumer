import { Application } from '@feathersjs/feathers';
import { SQS } from 'aws-sdk';

declare module '../../declarations' {
  interface Configuration {
    sqsClient: SQSAdapter
  }
}

interface SQSOptions {
  region: string;
  retryQueueUrl: string;
  dlqQueueUrl: string;
}

class SQSAdapter {
  private sqs: SQS;
  private queues: { [key: string]: string };

  constructor(options: SQSOptions) {
    // Local Configuration
    //this.sqs = new SQS({ region: options.region, accessKeyId: process.env.SQS_ACCESS_KEY_ID, secretAccessKey: process.env.SQS_SECRET_ACCESS_KEY });
    this.sqs = new SQS({ region: options.region });
    this.queues = {
      retry: options.retryQueueUrl,
      dlq: options.dlqQueueUrl
    }
  }

  async create(data: any, params: any) {
    const sqsParams: SQS.SendMessageRequest = {
      MessageBody: JSON.stringify(data),
      QueueUrl: this.queues[params.queue],
    };

    await this.sqs.sendMessage(sqsParams).promise();

    return data;
  }

  async get(queue: string) {
    const params = {
      QueueUrl: this.queues[queue],
      MaxNumberOfMessages: 10, // Maximum number of messages to retrieve (adjust as needed)
      VisibilityTimeout: 10, // Time during which the message will be invisible to others after being received (adjust as needed)
      WaitTimeSeconds: 20, // Long polling wait time (adjust as needed)
    };

    try {
      const data = await this.sqs.receiveMessage(params).promise();
      return data.Messages ?? [];

    } catch (error) {
      console.error('Error receiving messages from SQS:', error);
      return [];
    }
  }

  async remove(receiptHandle: any, queue: string) {
    const deleteParams = {
      QueueUrl: this.queues[queue],
      ReceiptHandle: receiptHandle,
    };

    try {
      await this.sqs.deleteMessage(deleteParams).promise();
      console.log('Message deleted from the queue');
    } catch (error) {
      console.error('Error deleting message from SQS:', error);
    }
  }
  // Implement other Feathers service methods as needed (update, get, remove, etc.)
}

export const SQSService = (app: Application) => {
  const config = app.get('sqs')
  const sqs = new SQSAdapter(config);

  app.set('sqsClient', sqs);
}