import { MechanicalCaseStatus, getMechanicalCaseStatus } from "./enums";
import { DMSMessage, RetryCaseData } from "./interfaces/message-declarations-ers";
import { app } from "src/app";


enum Operation {
    Load = "load",
    Insert = "insert",
    Update = "update",
}

async function sendToQueue(dmsMessage: DMSMessage): Promise<any> {
    const sqsClient = app.get('sqsClient');

    try {
        const later10sec = Date.now() + 10 * 1000;
        const eventNumber = dmsMessage.data.EventNumber;
        const message: RetryCaseData = {
            id: dmsMessage.data.id ?? eventNumber ?? '',
            case_number: dmsMessage.data.case_number ?? eventNumber ?? '',
            status: dmsMessage.data.status,
            retryNumber: 1,
            nextRetry: new Date(later10sec).toISOString(),
            caseData: dmsMessage.data,
        }
        return await sqsClient.create(message, { queue: 'retry' });
    } catch (e) {
        //TODO
        // Create logs and audits
        throw e;
    }
}

export class MessageHandlerErs {

    private static async processRollingCase(data: DMSMessage['data'], logs: string[]): Promise<void> {
        if (data.status !== MechanicalCaseStatus.Rolling
            && getMechanicalCaseStatus(data) !== MechanicalCaseStatus.Rolling) {
            logs.push('Mechanical case is not Vehicle Rolling.');
            return;
        }

        await app.get('mechanicalEmailService').process(data);
        logs.push('Vehicle Rolling email processed.');
    }

    static async process(message: string) {
        const logs: string[] = [];
        console.log("Processing message: ");
        let dmsMessage: DMSMessage;
        try {
            dmsMessage = JSON.parse(message);
        } catch (e) {
            console.error(JSON.stringify({ error: "Message received is not a valid JSON", message: message }));
            return;
        }

        console.log(JSON.stringify({
            Metadata: dmsMessage.metadata,
            Data: dmsMessage.data
        }));

        switch (dmsMessage.metadata.operation) {
            case Operation.Load:
                console.log("Operation 'load'. Nothing to do for this case.");
                logs.push("Operation 'load'. Nothing to do for this case.");
                break;
            case Operation.Insert:
            case Operation.Update:
                try {
                    await MessageHandlerErs.processRollingCase(dmsMessage.data, logs);
                } catch (e) {
                    console.error("Error detected: ", e);
                    logs.push(`Error: ${e.message}`);
                    await sendToQueue(dmsMessage);
                }
                break;
            default:
                console.error(`Operation '${dmsMessage.metadata.operation}'. This operation is not considered.`);
                logs.push(`Operation '${dmsMessage.metadata.operation}'. This operation is not considered.`);
                break;
        }

        console.log("Finish procesing message...");
        // We log the entire processing result
        console.log(JSON.stringify({
            id: `dms~${dmsMessage.data?.EventNumber ?? dmsMessage.data?.case_number ?? 'undefined'}`,
            dmsMessage,
            logs
        }));
        //await delay(10000);
    }
}