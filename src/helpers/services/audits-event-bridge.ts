import { Application } from '@feathersjs/feathers';
import { EventBridge } from 'aws-sdk';
import { PutEventsRequest, PutEventsResponse } from 'aws-sdk/clients/eventbridge';
import { OutputMainCase } from '../interfaces/oncall-declarations';

declare module '../../declarations' {
    interface Configuration {
        auditsEventBridgeClient: AuditsEventBridgeAdapter
    }
}

interface AuditsEventBridgeOptions {
    auditsBusARN: string;
    appName: string;
}

interface AuditsData {
    body: OutputMainCase;
    response: PutEventsResponse;
}

interface AuditsParams {
    new: string;
}

class AuditsEventBridgeAdapter {
    private eventbridge: EventBridge;
    private auditsBusARN: string;
    private appName: string;

    constructor(options: AuditsEventBridgeOptions) {
        this.eventbridge = new EventBridge();
        this.auditsBusARN = options.auditsBusARN;
        this.appName = options.appName;
    }

    async create(data: AuditsData, params: AuditsParams) {
        try {
            const putEventsRequest: PutEventsRequest = {
                Entries: [{ // One or more audit events. Each entry must be less than 256KB in size (https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-putevent-size.html)
                    Source: `${this.appName}`,    // Detail the component creating the event. The AWS account ID is already added by the client library.
                    EventBusName: `${this.auditsBusARN}`, // ARN of the target bus. Name is enough if the bus belongs to the same account. Environments are 'integration', 'testing', 'staging' and 'production'
                    DetailType: 'event.sent', // Used to categorize events going to a common bus (name of the entity and how it changed is a suggestion on the format).
                    Detail: JSON.stringify({
                        audits: [ // One or more audits for the same event. This example is from the lambda proxy for external APIs.
                            {
                                app: `${this.appName}`,                                    // Application name
                                service: `${this.appName}`, // URL of the service
                                tag: `${data.body.caseNumber}`,                            // Detail, useful for auditing many entries for a single call
                                message: 'undefined',                     // Message with additional information
                                timestamp: new Date(),                      // Timestamp of the event
                                httpMethod: params.new ? "POST" : "PUT", // todo NEW = POST - UPDATE = PUT                                 // HTTP method used (if an API call)
                                input: `${JSON.stringify(data.body)}`,                    // Request body, headers, or any input in general
                                output: `${JSON.stringify(data.response)}`,                  // Request response, headers, or any output in general
                                retentionDays: 60,                                  // Days to retain the entry, before it can be cleaned
                            },
                        ]
                    }),

                }]
            }
            const result: PutEventsResponse = await this.eventbridge.putEvents(putEventsRequest).promise(); // Only the putting of events in the bus is synchronized.
            if (result.FailedEntryCount && result.FailedEntryCount > 0) {
                console.log('PUT AUDIT ERROR FailedEntryCount ', data.body.caseNumber, JSON.stringify(data.body))
            }
        } catch (error) {
            console.log('PUT AUDIT ERROR: ', JSON.stringify(error))
        }
    }

}


export const AuditsService = (app: Application) => {
    const config: AuditsEventBridgeOptions = {
        auditsBusARN: app.get('auditsARN'),
        appName: app.get('appName'),
    }
    const audits = new AuditsEventBridgeAdapter(config);

    app.set('auditsEventBridgeClient', audits);
}
