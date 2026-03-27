import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!);

async function main() {
    await sql`
        DO $$ BEGIN
            CREATE TYPE "public"."user_role" AS ENUM ('user', 'freeUse', 'admin');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$
    `;
    console.log('✓ Enum user_role créé (ou déjà existant)');

    await sql`
        ALTER TABLE "profiles"
            ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'user'
    `;
    console.log('✓ Colonne role ajoutée à profiles');

    await sql.end();
    console.log('Migration appliquée avec succès.');
}

main().catch((e) => { console.error('Erreur:', e); process.exit(1); });
