import { Client } from '@elastic/elasticsearch';
import type { Application } from '../../declarations';

export const elasticSearchClientPath = 'elasticSearchClient';

declare module '../../declarations' {
  interface Configuration {
    [elasticSearchClientPath]: Client;
  }
}

export const elasticsearch = (app: Application): void => {
  const client = new Client({
    node: app.get('elasticSearchUrl'),
    headers: { api_key: `x-auth ${app.get('appToken')}` },
  });
  app.set(elasticSearchClientPath, client);
};
