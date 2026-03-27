import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env.local' });

export default defineConfig({
    schema:  './src/lib/db/schema.ts',
    out:     './src/lib/db/migrations',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    // Affiche les requêtes SQL générées dans la console
    verbose: true,
    strict:  true,
});
