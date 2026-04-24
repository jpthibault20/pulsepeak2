/******************************************************************************
 * @file    strava-sync.ts
 * @brief   Synchronisation des activités Strava → workouts PulsePeak.
 *
 *          Flux :
 *          1. Liste paginée des activités de l'année courante (Strava).
 *          2. Dedup sur stravaId déjà importé.
 *          3. Limitation plan gratuit (FREE_STRAVA_LIMIT = 5 activités).
 *          4. Fetch détaillé EN PARALLÈLE avec retry exponentiel.
 *          5. Matching best-effort sur (date + sport) avec une séance planifiée,
 *             sinon création d'une "Sortie Libre" rattachée à la semaine active.
 *          6. Passage en "missed" des séances pending antérieures à aujourd'hui.
 *          7. Recalcul CTL/ATL via recalculateFitnessMetrics().
 ******************************************************************************/

'use server';

import { randomUUID } from 'crypto';
import { addDays } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import {
    getBlock,
    getProfile,
    getWeek,
    getWorkout,
    saveWeek,
    saveWorkout,
} from '@/lib/data/crud';
import type { SportType } from '@/lib/data/type';
import { Workout } from '@/lib/data/DatabaseTypes';
import {
    getStravaActivitiesAllPages,
    getStravaActivityById,
} from '@/lib/strava-service';
import { mapStravaSport } from '@/lib/strava-mapper';
import { recalculateFitnessMetrics } from './fitness-metrics';


export async function syncStravaActivities() {
    console.log("⚡ Début Sync Strava...");

    // Helper : retry avec backoff exponentiel
    async function fetchWithRetry<T>(
        fn: () => Promise<T | null>,
        id: number,
        maxRetries = 2
    ): Promise<T | null> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                if (result !== null) return result;
            } catch {
                // fall through to retry
            }
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                console.log(`   🔁 Retry ${attempt + 1}/${maxRetries} pour l'activité ${id}...`);
            }
        }
        console.warn(`   ⚠️ Activité ${id} non récupérée après ${maxRetries} retry.`);
        return null;
    }

    try {
        // 1. Charger les données actuelles
        const [profile, existingWorkouts, existingWeeks, existingBlocks] = await Promise.all([
            getProfile(),
            getWorkout(),
            getWeek(),
            getBlock(),
        ]);

        const workouts: Workout[] = existingWorkouts ?? [];

        // ── Déterminer les droits Strava ──────────────────────────────────────
        const FREE_STRAVA_LIMIT = 5;
        const isFreePlan =
            (profile?.plan ?? 'free') === 'free' &&
            profile?.role !== 'admin';

        // 2. Compter les activités Strava existantes (pour la limite free)
        const stravaWorkouts = workouts.filter(w =>
            w.status === 'completed' &&
            w.completedData?.source?.type === 'strava'
        );

        // 3. Sync complète de l'année en cours (pagination).
        //    On récupère toujours toutes les summaries (1-2 appels légers per_page=200),
        //    le dedup en étape 4 évite de re-fetcher les détails des activités déjà connues.
        //    Cela garantit qu'aucune activité n'est ratée, même si la première sync était incomplète.
        const currentYear = new Date().getFullYear();
        const startOfYear = Math.floor(new Date(`${currentYear}-01-01T00:00:00Z`).getTime() / 1000);

        console.log(`📅 Sync complète ${currentYear} (pagination)...`);
        const activitiesSummary: { id: number; start_date: string; [key: string]: unknown }[] =
            await getStravaActivitiesAllPages(startOfYear);
        console.log(`📊 ${activitiesSummary.length} activité(s) trouvée(s) sur Strava pour ${currentYear}`);

        if (!activitiesSummary || activitiesSummary.length === 0) {
            console.log("✅ Aucune nouvelle activité à synchroniser.");
            return { success: true, count: 0 };
        }

        // 4. Filtrer les doublons avant tout fetch
        const newSummaries = activitiesSummary.filter((summary: { id: number }) =>
            !workouts.some(w =>
                w.completedData?.source?.type === 'strava' &&
                w.completedData.source.stravaId === summary.id
            )
        );

        if (newSummaries.length === 0) {
            console.log("✅ Toutes les activités sont déjà à jour.");
            return { success: true, count: 0 };
        }

        // ── Appliquer la limite plan free ─────────────────────────────────────
        let summariesToProcess = newSummaries;
        if (isFreePlan) {
            const slotsRemaining = Math.max(0, FREE_STRAVA_LIMIT - stravaWorkouts.length);
            if (slotsRemaining === 0) {
                console.log(`🔒 Plan gratuit : limite de ${FREE_STRAVA_LIMIT} activités Strava atteinte. Passez à l'offre Développeur pour tout synchroniser.`);
                return { success: true, count: 0, limitReached: true };
            }
            summariesToProcess = [...newSummaries]
                .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                .slice(0, slotsRemaining);
            console.log(`🔒 Plan gratuit : import limité à ${slotsRemaining} activité(s) (${stravaWorkouts.length}/${FREE_STRAVA_LIMIT} déjà importées).`);
        }

        console.log(`📥 ${summariesToProcess.length} nouvelles activités à récupérer (sur ${activitiesSummary.length}).`);

        // 5. Récupérer tous les détails en PARALLÈLE avec retry
        const detailResults = await Promise.allSettled(
            summariesToProcess.map((summary: { id: number }) =>
                fetchWithRetry(() => getStravaActivityById(summary.id), summary.id)
            )
        );

        let newItemsCount = 0;
        const updatedWeeks = existingWeeks ? [...existingWeeks] : [];

        // 6. Traiter chaque résultat
        for (let i = 0; i < summariesToProcess.length; i++) {
            const summary = summariesToProcess[i];
            const result = detailResults[i];

            if (result.status === 'rejected' || !result.value) {
                console.warn(`   ⏭  Skip: impossible de récupérer l'activité ${summary.id}.`);
                continue;
            }

            const { raw: detail, completedData } = result.value;
            const activityDate = summary.start_date.split('T')[0];
            const stravaSport = mapStravaSport(String(summary.type ?? detail.type ?? ''));

            // 🧠 MATCHING : séance planifiée existante pour cette date ET le même sport ?
            const matchingIndex = workouts.findIndex(w =>
                w.date === activityDate &&
                w.status !== 'completed' &&
                w.sportType === stravaSport
            );

            if (matchingIndex !== -1) {
                console.log(`   🤝 Match le ${activityDate} (${stravaSport}) -> mise à jour du plan.`);
                workouts[matchingIndex].status = 'completed';
                workouts[matchingIndex].completedData = completedData;
            } else {
                console.log(`   ➕ Activité libre ajoutée : ${activityDate} (${stravaSport})`);

                const sportType: SportType = stravaSport !== 'other' ? stravaSport
                    : completedData.metrics.swimming ? 'swimming'
                    : completedData.metrics.running ? 'running'
                    : completedData.metrics.cycling ? 'cycling'
                    : 'other';

                // Trouver la semaine du bloc actif correspondant à cette date
                let activeWeekID = '';
                const newWorkoutId = randomUUID();
                if (existingBlocks && existingWeeks) {
                    const activityDateObj = parseLocalDate(activityDate);

                    const activeBlock = existingBlocks.find(block => {
                        const blockStart = parseLocalDate(block.startDate);
                        const blockEnd = addDays(blockStart, block.weekCount * 7);
                        return activityDateObj >= blockStart && activityDateObj < blockEnd;
                    });

                    if (activeBlock) {
                        const blockStart = parseLocalDate(activeBlock.startDate);
                        const blockWeeks = existingWeeks.filter(w => activeBlock.weeksId?.includes(w.id));
                        const activeWeek = blockWeeks.find(week => {
                            const weekStart = addDays(blockStart, (week.weekNumber - 1) * 7);
                            const weekEnd = addDays(weekStart, 6);
                            return activityDateObj >= weekStart && activityDateObj <= weekEnd;
                        });

                        if (activeWeek) {
                            activeWeekID = activeWeek.id;
                            const weekIdx = updatedWeeks.findIndex(w => w.id === activeWeek.id);
                            if (weekIdx !== -1) {
                                if (!updatedWeeks[weekIdx].workoutsId.includes(newWorkoutId)) {
                                    updatedWeeks[weekIdx] = {
                                        ...updatedWeeks[weekIdx],
                                        workoutsId: [...updatedWeeks[weekIdx].workoutsId, newWorkoutId],
                                    };
                                }
                            }
                        }
                    }
                }

                workouts.push({
                    id: newWorkoutId,
                    userId: profile?.id ?? '',
                    weekId: activeWeekID,
                    date: activityDate,
                    sportType,
                    title: detail.name,
                    workoutType: 'Sortie Libre',
                    mode: 'Outdoor',
                    status: 'completed',
                    plannedData: {
                        durationMinutes: 0,
                        targetPowerWatts: null,
                        targetPaceMinPerKm: null,
                        targetHeartRateBPM: null,
                        distanceKm: null,
                        plannedTSS: null,
                        description: null,
                        structure: [],
                    },
                    completedData,
                });
            }
            newItemsCount++;
        }

        // 6b. Marquer les séances planifiées passées (avant aujourd'hui, fuseau Europe/Paris) non réalisées comme "missed"
        const todayParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
        const todayStr = `${todayParis.getFullYear()}-${String(todayParis.getMonth() + 1).padStart(2, '0')}-${String(todayParis.getDate()).padStart(2, '0')}`;
        for (const w of workouts) {
            if (w.status === 'pending' && !w.completedData && w.date < todayStr) {
                w.status = 'missed';
                newItemsCount++;
            }
        }

        // 7. Sauvegarder si changements
        if (newItemsCount > 0) {
            workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            await saveWorkout(workouts);
            if (existingWeeks && updatedWeeks.some((w, i) => w !== existingWeeks[i])) {
                await saveWeek(updatedWeeks);
            }
            console.log(`💾 ${newItemsCount} activité(s) sauvegardée(s).`);
            await recalculateFitnessMetrics();
        }

        return { success: true, count: newItemsCount };

    } catch (error) {
        console.error("❌ Erreur Sync Strava:", error);
        return { success: false, error };
    }
}
