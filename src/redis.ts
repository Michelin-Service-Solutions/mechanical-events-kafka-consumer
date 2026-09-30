import { RedisClientType, createClient } from "redis";
import { Application } from "./declarations";

export const redisClientPath = "redisClient";

declare module "./declarations" {
  interface Configuration {
    [redisClientPath]: RedisHelper;
  }
}

class RedisHelper {
  private prefix = "";
  private url = "";
  private redisClient: RedisClientType<any, any, any> | undefined;

  constructor(host: string, prefix: string) {
    this.url = host;
    this.prefix = prefix;
  }

  private async getClient(): Promise<RedisClientType<any, any, any>> {
    if (!this.redisClient) {
      this.redisClient = await createClient({
        url: this.url,
      }).on("error", (err) => console.log("Redis Client Error", err))
        .connect();
    }

    return this.redisClient;
  }

  public async get(key: string, prefix?: string) {
    const client = await this.getClient();
    return await client.get(`${prefix ?? this.prefix}-${key}`);
  }

  public async setIfAbsent(key: string, value: any, expirationInMin: number = 10): Promise<boolean> {
    const client = await this.getClient();
    const result = await client.set(`${this.prefix}-${key}`, value, {
      EX: expirationInMin * 60,
      NX: true,
    });
    return result === 'OK';
  }

  public async set(key: string, value: any, expirationInMin: number = 10): Promise<void> {
    await this.setIfAbsent(key, value, expirationInMin);
  }

  public async delete(key: string) {
    const client = await this.getClient();
    await client.del(`${this.prefix}-${key}`);
  }
}

export default function (app: Application): void {
  const { host, prefix } = app.get("redis");

  console.log("RedisHelper connection host:", host);
  const redisClient = new RedisHelper(host, prefix);
  app.set(redisClientPath, redisClient);
}
