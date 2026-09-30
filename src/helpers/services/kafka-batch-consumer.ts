import { Consumer, ConsumerConfig, ConsumerRunConfig, ConsumerSubscribeTopics, EachBatchPayload, Kafka, KafkaConfig } from 'kafkajs';
import { Application } from 'src/declarations';
import { MessageHandlerErs } from '../message-handler-ers';

declare module '../../declarations' {
  interface Configuration {
    KafkaBatchConsumer: KafkaBatchConsumer
  }
}
type ConsumerWithTopicsConfig = ConsumerConfig & ConsumerSubscribeTopics
export class KafkaBatchConsumer {
  private kafka!: Kafka;
  private consumer!: Consumer;

  constructor(
    private kafkaConfig: KafkaConfig,
    private consumerConfig: ConsumerWithTopicsConfig,
  ) { }

  async init(): Promise<void> {
    console.log("config kafka:", JSON.stringify(this.kafkaConfig));
     console.log("config consumerConfig:", JSON.stringify(this.consumerConfig));
    this.kafka = new Kafka(this.kafkaConfig);
    this.consumer = this.kafka.consumer(this.consumerConfig as ConsumerConfig);
  }

  async subscribeConsumer(): Promise<void> {
    if (this.consumer) {
      await this.consumer.connect();

      await this.consumer.subscribe(this.consumerConfig as ConsumerSubscribeTopics);
    } else {
      throw new Error('Consumer not initialized');
    }
  }

  async run(): Promise<void> {
    await this.init();
    await this.subscribeConsumer();

    const runConfig: ConsumerRunConfig = {
      eachBatchAutoResolve: true,
      eachBatch: async (payload: EachBatchPayload) => {

        console.log(`BATCH RECEIVED SIZE: ${payload.batch.messages.length} - Topic: ${payload.batch.topic}, partition: ${payload.batch.partition}`);

        for (const message of payload.batch.messages) {
          console.log(`offset: ${message.offset}, key (partyNumber): ${message.key}`);

          try {

            if (message.value) {
              await MessageHandlerErs.process(message.value.toString());
            }
          } catch (e: any) {
            console.error("ERROR PROCESING MESSAGE: ", e.message);
            throw e;
          }

          //await delay(10000);
          await payload.heartbeat();
        }
      },
    };

    this.consumer.run(runConfig);
  }
}

export const KafkaConsumerService = (app: Application) => {
  const { connection, consumer } = app.get('kafka');

  const kafkaConsumer = new KafkaBatchConsumer(connection, consumer);

  app.set('KafkaBatchConsumer', kafkaConsumer);
}