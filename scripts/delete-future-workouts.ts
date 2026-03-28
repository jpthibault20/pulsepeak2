/**
 * Script : supprime tous les workouts dont la date est >= aujourd'hui.
 *
 * Usage :
 *   npm run db:delete-future          → supprime
 *   npm run db:delete-future -- --dry-run  → affiche sans supprimer
 *   npm run db:delete-future -- --from 2026-04-01  → depuis une date précise
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DRY_RUN = process.argv.includes('--dry-run');

// --from YYYY-MM-DD (optionnel, sinon = aujourd'hui)
const fromArg = (() => {
    const idx = process.argv.indexOf('--from');
    return idx !== -1 ? process.argv[idx + 1] : null;
})();

const FROM_DATE = fromArg ?? new Date().toISOString().slice(0, 10);

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client);

interface WorkoutRow extends Record<string, unknown> {
    id:        string;
    userId:    string;
    date:      string;
    title:     string;
    sportType: string;
    status:    string;
}

async function main() {
    console.log(`\n🗓️  Suppression des workouts à partir du ${FROM_DATE}\n`);
    if (DRY_RUN) console.log('   ⚠️  Mode DRY-RUN : aucune suppression ne sera effectuée.\n');

    // 1. Lister les workouts concernés
    const rows = await db.execute<WorkoutRow>(sql`
        SELECT
            id,
            user_id    AS "userId",
            date,
            title,
            sport_type AS "sportType",
            status
        FROM workouts
        WHERE date >= ${FROM_DATE}
        ORDER BY date ASC
    `);

    if (rows.length === 0) {
        console.log(`✅ Aucun workout trouvé à partir du ${FROM_DATE}.\n`);
        return;
    }

    // 2. Afficher le résumé
    console.log(`   ${rows.length} workout(s) trouvé(s) :\n`);

    const byMonth: Record<string, WorkoutRow[]> = {};
    for (const r of rows) {
        const month = r.date.slice(0, 7); // YYYY-MM
        if (!byMonth[month]) byMonth[month] = [];
        byMonth[month].push(r);
    }

    for (const [month, list] of Object.entries(byMonth)) {
        console.log(`   📅 ${month} (${list.length} séance(s))`);
        for (const w of list) {
            const icon = w.sportType === 'cycling' ? '🚴' : w.sportType === 'running' ? '🏃' : '🏊';
            console.log(`      ${icon} ${w.date}  [${w.status.padEnd(9)}]  ${w.title}`);
        }
    }

    console.log(`\n   Total : ${rows.length} workout(s) à supprimer.\n`);

    if (DRY_RUN) {
        console.log('   ⚠️  DRY-RUN : aucune suppression effectuée.\n');
        return;
    }

    // 3. Supprimer
    const result = await db.execute(sql`
        DELETE FROM workouts
        WHERE date >= ${FROM_DATE}
    `);

    const deleted = (result as unknown as { count: number }).count ?? rows.length;
    console.log(`✅ ${deleted} workout(s) supprimé(s).\n`);
}

main()
    .catch((err) => {
        console.error('\n❌ Erreur :', err);
        process.exit(1);
    })
    .finally(() => client.end());
