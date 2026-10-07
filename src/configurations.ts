
import fs from 'fs';
// Declarations.
import { Application } from './declarations';
// Utils.
import { KafkaConsumerService } from './helpers/services/kafka-batch-consumer';
import redis from './redis';
import { SQSService } from './helpers/services/sqs-adapter';
import { mechanicalEmailService } from './helpers/services/mechanical-email';
import { elasticsearch } from './helpers/services/elasticsearch';
import { notificationTemplates } from './helpers/services/notification-templates';

export function configure_after(app: Application): void {
  addHealthCheck(app);
  app.configure(redis);
  app.configure(KafkaConsumerService);
  app.configure(SQSService);
  app.configure(elasticsearch);
  mechanicalEmailService(app);
  notificationTemplates(app);
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
