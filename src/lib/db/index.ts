import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// La connexion directe à la DB Postgres de Supabase.
// Utilise le Transaction Pooler (port 6543) pour les environnements serverless/edge.
// DATABASE_URL = "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"

const connectionString = process.env.DATABASE_URL!;

// prepare: false requis pour le mode Transaction Pooler de Supabase
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
