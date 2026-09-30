import { EventBridge } from '@aws-sdk/client-eventbridge';

const eventBridge = new EventBridge({ region: 'us-east-1' });

export class Logger {
  private static instance: Logger;
  private busName: string;
  private app: string;
  private auditRetentionDays: number;

  private constructor(app: string, busName: string, auditRetentionDays: number) {
    this.app = app;
    this.busName = busName;
    this.auditRetentionDays = auditRetentionDays;
  }

  public static init(app: string, busName: string, auditRetentionDays: number = 15): Logger {
    if (!this.instance) {
      this.instance = new Logger(app, busName, auditRetentionDays);
    }
    return this.instance;
  }

  public static getInstance(): Logger {
    if (!this.instance) {
      throw new Error('there is not instance initialized, use Logger.init(busName)');
    }
    return this.instance;
  }

  async audit(report: string, tag: string, message: string, input: any, output: any, method = 'POST') {
    const service = report;

    try {
      await this.sendEvent({
        app: this.app,
        service,
        tag,
        message,
        timestamp: new Date().toISOString(),
        httpMethod: method,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
        retentionDays: this.auditRetentionDays,
      });
    } catch (error) {
      console.log('ERROR putting event');
      console.error(error);

      //splitting
      const complete = JSON.stringify(output);
      console.log('output size', complete.length);

      try {
        await this.sendEvent({
          app: this.app,
          service,
          tag,
          message: message + ' split1',
          timestamp: new Date().toISOString(),
          httpMethod: method,
          input: JSON.stringify(input),
          output: complete.substring(1, complete.length / 2),
          retentionDays: this.auditRetentionDays,
        });

        await this.sendEvent({
          app: this.app,
          service,
          tag,
          message: message + ' split2',
          timestamp: new Date().toISOString(),
          httpMethod: method,
          input: JSON.stringify(input),
          output: complete.substring(complete.length / 2 + 1),
          retentionDays: this.auditRetentionDays,
        });
      } catch (error) {
        console.log('ERROR splitting event');
        console.error(error);
        // Ignoring error to continue with proxy execution
      }
    }
  }

  async sendEvent(audit: any) {
    const beforeEventRequest = {
      Entries: [
        {
          Source: process.env.AWS_LAMBDA_FUNCTION_NAME,
          DetailType: 'audits',
          EventBusName: this.busName,
          Detail: JSON.stringify({
            audits: [audit],
          }),
        },
      ],
    };
    await eventBridge.putEvents(beforeEventRequest);
  }
}
