import Knex from 'knex';

interface PostgresConfig {
  host: string,
  user: string,
  password: string,
  database: string,
  port?: string
}

export function postgresClient({
  host,
  user,
  password,
  database,
  port,
}: PostgresConfig) {
  console.log(
    'CONFIG:',
    JSON.stringify({
      host,
      user,
      password,
      database,
      port,
    }),
  );

  const db = Knex({
    client: 'pg', // Specify the PostgreSQL client
    connection: {
      host,
      user,
      password,
      database,
      port: port ? Number(port) : undefined,
    },
  });
  return db;
}
