import { RedisClientType, createClient } from "redis";

export class RedisHelper {
    private prefix = '';
    private url = '';
    private redisClient: RedisClientType<any, any, any> | undefined;

    constructor(url: string, prefix: string) {
        this.url = url;
        this.prefix = prefix;
    }

    private async getClient(): Promise<RedisClientType<any, any, any>> {
        if (!this.redisClient) {
            this.redisClient = await createClient({
                url: this.url
            }).on('error', err => console.log('Redis Client Error', err))
                .connect();
        }

        return this.redisClient;
    }

    public async get(key: string) {
        const client = await this.getClient();
        return await client.get(`${this.prefix}-${key}`);
    }

    public async set(key: string, value: any) {
        const client = await this.getClient();
        await client.set(`${this.prefix}-${key}`, value);
    }

    public async delete(key: string) {
        const client = await this.getClient();
        await client.del(`${this.prefix}-${key}`);
    }
}
