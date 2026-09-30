import { Kafka, AdminConfig, Producer, KafkaConfig, Admin, Message } from "kafkajs";
import { AclOperationTypes, AclPermissionTypes, AclResourceTypes, ResourcePatternTypes } from 'kafkajs'
import { Application } from "src/declarations";


declare module '../../declarations' {
    interface Configuration {
        KafkaManagerService: KafkaManager
    }
}

export class KafkaManager {
    private kafka: Kafka;
    private admin: Admin;
    private producer: Producer;

    constructor(kafkaConfig: KafkaConfig, adminConfig?: AdminConfig) {
        this.kafka = new Kafka(kafkaConfig);
        this.admin = this.kafka.admin(adminConfig);
        this.producer = this.kafka.producer();
    }

    async initProducer(){
        try {
             await this.connectProducer();
        } catch (error) {
            console.error('Failed to initialize Kafka Manager:', error);
            throw error;
        }
    }

    async publishMessageOnTopic(topic: string, data: any) {
        try {
            const msg: Message = {
                value: JSON.stringify(data)
            }
            await this.producer.send({
                topic: topic,
                messages: [msg]
            })
            console.log(`Message sent to topic ${topic}`);
        } catch (error) {
            console.error('Failed to publish message to Kafka:', error);
            throw error;
        }
    }
    
    async createTopicIfNotExist(topicName: string, numPartitions: number = 10, replicationFactor: number= 2) {
        try {
            await this.connectAdmin();

            if (!(await this.existsTopic(topicName))) {
                console.log(`Creating topic: ${topicName}`);
                await this.createTopics([{ topic:topicName, numPartitions, replicationFactor }]);
            } else {
                console.log(`Topic ${topicName} already exists.`);
            }
            
            await this.disconnectAdmin();
        } catch (error) {
            console.error('Failed to create Kafka topics:', error);
            throw error;
        }
    }

   async createACL(topic: string, userName:string) {
        const acl = [
          {
            resourceType: AclResourceTypes.TOPIC,
            resourceName: topic,
            resourcePatternType: ResourcePatternTypes.LITERAL,
            principal: `User:${userName}`,
            host: '*',
            operation: AclOperationTypes.READ,
            permissionType: AclPermissionTypes.ALLOW,
          },                 
          {
            resourceType: AclResourceTypes.TOPIC,
            resourceName: topic,
            resourcePatternType: ResourcePatternTypes.LITERAL,
            principal: `User:${userName}`,
            host: '*',
            operation: AclOperationTypes.DESCRIBE,
            permissionType: AclPermissionTypes.ALLOW,
          },
           {
            resourceType: AclResourceTypes.GROUP,
            resourceName: topic,
            resourcePatternType: ResourcePatternTypes.PREFIXED,
            principal: `User:${userName}`,
            host: '*',
            operation: AclOperationTypes.READ,
            permissionType: AclPermissionTypes.ALLOW,
          },
          
        ]
    
        await this.admin.createAcls({ acl })
      }

    private async connectAdmin() {
        try {            
            await this.admin.connect();
            
        } catch (error) {
            console.error('Failed to connect Kafka admin:', error);
            throw error;
        }
    }

    private async existsTopic(topic: string): Promise<boolean> {
        try {
            const topics = await this.admin.listTopics();
            const exists = topics.includes(topic);
            console.log(`Topic ${topic} exists:`, exists);
            return exists;
        } catch (error) {
            console.error('Failed to check if topic exists:', error);
            throw error;
        }
    }

    private async listTopics() {
        try {
            const topics = await this.admin.listTopics();
            console.log('Kafka topics:', topics);
            return topics;
        } catch (error) {
            console.error('Failed to list Kafka topics:', error);
            throw error;
        }
    }

    private async createTopics(topicConfig: { topic: string; numPartitions: number; replicationFactor: number }[]) {
        try {
            const result = await this.admin.createTopics({
                topics: topicConfig,
                timeout: 30000,
                waitForLeaders: true,
            });
            if (result) {
                console.log('Kafka topics created successfully.');
            } else {
                console.log('Kafka topics were already created.');
            }
        } catch (error) {
            console.error('Failed to create Kafka topics:', error);
            throw error;
        }
    }

    private async disconnectAdmin() {
        try {
            console.log('Disconnecting Kafka admin...');
            await this.admin.disconnect();
            console.log('Kafka admin disconnected.');
        } catch (error) {
            console.error('Failed to disconnect Kafka admin:', error);
            throw error;
        }
    }

    private async connectProducer() {
        try {            
            await this.producer.connect();
            console.log("Producer connected successfully.");
        } catch (error) {
            console.error('Failed to connect Kafka producer:', error);
            throw error;
        }
    }
}

export const KafkaManagerService = (app: Application) => {
    const { connection } = app.get('kafka');    
    console.log("config kafka:",connection);
    const kafkaManager = new KafkaManager(connection);
    app.set('KafkaManagerService', kafkaManager);
}