import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  var _postgresClient: postgres.Sql | undefined;
}

function createClient(connectionString: string) {
  // Compatible con Supabase Transaction Pooler (puerto 6543 / PgBouncer)
  // y con PostgreSQL local en Docker (puerto 5433 sin SSL)
  const isLocal =
    connectionString.includes('localhost') ||
    connectionString.includes('127.0.0.1') ||
    connectionString.includes(':5433');

  return postgres(connectionString, {
    prepare: false,
    ssl: isLocal ? false : undefined,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

function getClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables.');
  }

  if (process.env.NODE_ENV === 'production') {
    return createClient(connectionString);
  }

  if (!globalThis._postgresClient) {
    globalThis._postgresClient = createClient(connectionString);
  }
  return globalThis._postgresClient;
}

export function getDb() {
  const client = getClient();
  return drizzle(client, { schema });
}

export const db = process.env.DATABASE_URL ? getDb() : (null as unknown as ReturnType<typeof getDb>);

export type AppDatabase = ReturnType<typeof getDb>;
