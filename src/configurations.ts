
import fs from 'fs';
// Declarations.
import { Application } from './declarations';
// Utils.
import { postgresql as oncallDB } from './helpers/services/postgresql-ers'
import { KafkaConsumerService } from './helpers/services/kafka-batch-consumer';
import { CentralService } from '../src/helpers/central'
import redis from './redis';
import { KafkaManagerService } from './helpers/services/kafka-manager';
import { SQSService } from './helpers/services/sqs-adapter';
import { mechanicalEmailService } from './helpers/services/mechanical-email';
import { elasticsearch } from './helpers/services/elasticsearch';
import { mechanicalCaseData } from './helpers/services/mechanical-case-data';



export async function configure_before(app: Application): Promise<void> {
  app.configure(KafkaManagerService);
}

export function configure_after(app: Application): void {
  addHealthCheck(app);
  app.configure(oncallDB);
  app.configure(redis);
  app.configure(CentralService);

  app.configure(KafkaConsumerService);
  app.configure(SQSService);
  app.configure(elasticsearch);
  mechanicalCaseData(app);
  mechanicalEmailService(app);
}

function addHealthCheck(app: Application): void {
  app.use('/healthcheck',
    async (req: any, res: any) => {
      const version = await new Promise((resolve) => {
        fs.readFile('src/version/version.json', 'utf8', function (err, data) {
          if (err || !data) {
            resolve('null');
          } else {
            resolve(JSON.parse(data).version);
          }
        });
      });
      res.status(200).send({
        status: 'ok',
        version,
      });
    });
}
