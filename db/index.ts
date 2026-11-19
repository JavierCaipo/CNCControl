import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  var _postgresClient: postgres.Sql | undefined;
}

function createClient(connectionString: string) {
  // Compatible con Supabase Transaction Pooler (puerto 6543 / PgBouncer):
  // Se requiere { prepare: false } debido a que PgBouncer en Transaction mode
  // no soporta sentencias preparadas de PostgreSQL a nivel de servidor.
  return postgres(connectionString, {
    prepare: false,
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
