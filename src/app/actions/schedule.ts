'use server';

// Import de la fonction generatePlanFromAI
import { generatePlanFromAI, generateSingleWorkoutFromAI } from '@/lib/ai/coach-api';
import { getProfile, getSchedule, saveProfile, saveSchedule } from '@/lib/data/crud';
import { Schedule, Profile, Workout } from '@/lib/data/type';
import { revalidatePath } from 'next/cache';
// lib/actions/workoutActions.ts
import type { CompletedData, CompletedDataFeedback } from '@/lib/data/type';

// --- Helpers ---

// Calcul de l'historique pour le prompt AI
const getRecentPerformanceHistory = (schedule: Schedule): string => {
    // Sécurité: vérifier que schedule.workouts est un tableau
    const allWorkouts = Array.isArray(schedule.workouts) ? schedule.workouts : [];

    const workouts = allWorkouts
        .filter(w => w.status === 'completed' && w.completedData)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    if (workouts.length === 0) return "Aucune donnée récente. (Premier bloc)";

    return workouts.map(w => {
        const data = w.completedData!;
        const plannedDuration = w.plannedData?.durationMinutes || '?';

        // Récupération intelligente de la métrique clé selon le sport
        let perfMetric = 'N/A';
        
        // Si c'est du vélo, on cherche la puissance
        if (data.metrics.cycling?.avgPowerWatts) {
            perfMetric = `${data.metrics.cycling.avgPowerWatts}W`;
        } 
        // Si c'est de la course à pied, on pourrait afficher l'allure (exemple)
        else if (data.metrics.running?.avgPaceMinPerKm) {
             perfMetric = `${data.metrics.running.avgPaceMinPerKm} min/km`;
        }

        return `
      - Date: ${w.date}
      - Type: ${w.workoutType} (Prévu: ${plannedDuration} min)
      - Réalisé: ${data.actualDurationMinutes} min | ${data.distanceKm} km
      - RPE: ${data.perceivedEffort}/10 | Perf: ${perfMetric}
      - Notes: "${data.notes || ''}"
    `;
    }).join('\n');
};



// Helper pour trouver une séance par ID ou par Date (pour rétro-compatibilité)
const findWorkoutIndex1 = (workouts: Workout[], identifier: string): number => {
    return workouts.findIndex(w => w.id === identifier || w.date === identifier);
};

// --- Fonctions de lecture (initialisation) ---
export async function loadInitialData(): Promise<{ profile: Profile | null, schedule: Schedule | null }> {
    try {
        const profile = await getProfile();
        const schedule = await getSchedule();
        return { profile, schedule };
    } catch (error) {
        console.error("Erreur lors du chargement initial des données:", error);
        return { profile: null, schedule: null };
    }
}

// --- Fonctions d'écriture (mutation) ---

export async function saveAthleteProfile(data: Profile) {
    await saveProfile(data);
}

// Génération d'un nouveau plan (Ajout/Écrasement des dates concernées)
export async function generateNewPlan(blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) {
    console.log(`[Plan Generation] Focus: ${blockFocus}. Theme custom: ${customTheme}. Start Date: ${startDate}`);

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();

    if (!existingProfile) {
        throw new Error("Impossible de générer un plan sans profil athlète.");
    }

    const history = getRecentPerformanceHistory(existingSchedule);

    try {
        // Appel à l'IA
        const aiResponse = await generatePlanFromAI(
            existingProfile,
            history,
            blockFocus,
            customTheme,
            startDate,
            numWeeks
        );

        // MODIFICATION STRUCTURELLE
        // 1. On récupère les dates générées par l'IA
        const newDates = new Set(aiResponse.workouts.map(w => w.date));

        // 2. On garde toutes les anciennes séances QUI NE SONT PAS sur les dates générées
        const keptWorkouts = (existingSchedule.workouts || []).filter(w => !newDates.has(w.date));

        // 3. On prépare les nouvelles séances
        const newWorkouts = aiResponse.workouts.map(w => ({
            ...w,
            status: 'pending' as const,
        }));

        // 4. On fusionne
        const newSchedule: Schedule = {
            ...existingSchedule,
            workouts: [...keptWorkouts, ...newWorkouts], // Fusion des tableaux
            summary: aiResponse.synthesis,
            lastGenerated: new Date().toISOString().split('T')[0]
        };

        await saveSchedule(newSchedule);
        revalidatePath('/'); // Rafraîchir le cache Next.js

    } catch (error) {
        console.error("Échec de la génération de plan via l'IA:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Échec de la génération du plan par l'IA. Détail: ${errorMessage}`);
    }
}

// Régénération d'une séance unique
export async function regenerateWorkout(workoutIdOrDate: string, instruction?: string) {
    console.log(`[Workout Regeneration] ID/Date: ${workoutIdOrDate}, Instruction: ${instruction || 'None'}`);

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();

    if (!existingProfile) throw new Error("Profil manquant");

    // Trouver la séance cible
    const targetIndex = findWorkoutIndex1(existingSchedule.workouts, workoutIdOrDate);
    if (targetIndex === -1) throw new Error("Séance introuvable");
    
    const oldWorkout = existingSchedule.workouts[targetIndex];
    const dateKey = oldWorkout.date; // La date est nécessaire pour l'IA

    const history = getRecentPerformanceHistory(existingSchedule);
    const surroundingWorkouts = getSurroundingWorkouts(existingSchedule, dateKey);
    const blockFocus = "General Fitness"; // TODO: Stocker le focus actuel dans le Schedule si nécessaire

    try {
        const newWorkoutData = await generateSingleWorkoutFromAI(
            existingProfile,
            history,
            dateKey,
            surroundingWorkouts,
            oldWorkout,
            blockFocus,
            instruction
        );

        // Remplacement dans le tableau
        existingSchedule.workouts[targetIndex] = {
            ...newWorkoutData,
            id: oldWorkout.id, // On garde le même ID si possible, ou on prend le nouveau
            date: dateKey,
            status: 'pending',
            completedData: null // Reset des données complétées
        };

        await saveSchedule(existingSchedule);
        revalidatePath('/');

    } catch (error) {
        console.error("Échec régénération:", error);
        throw new Error("L'IA n'a pas pu créer la séance.");
    }
}

// Helper pour donner du contexte à l'IA (jours avant/après)
function getSurroundingWorkouts(schedule: Schedule, targetDate: string) {
    const target = new Date(targetDate);
    const context: Record<string, string> = {}; 

    // On parcourt le tableau pour trouver les voisins (plus lent que map mais robuste)
    // Idéalement, on filtrerait d'abord, mais sur <365 items c'est négligeable
    const surroundingDates = new Set<string>();
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const d = new Date(target);
        d.setDate(d.getDate() + i);
        surroundingDates.add(d.toISOString().split('T')[0]);
    }

    schedule.workouts.forEach(w => {
        if (surroundingDates.has(w.date)) {
            context[w.date] = `${w.workoutType} - ${w.title}`;
        }
    });

    return context;
}



/**
 * Trouve l'index d'un workout par ID ou Date
 */
function findWorkoutIndex(workouts: Workout[], idOrDate: string): number {
    return workouts.findIndex(w => w.id === idOrDate || w.date === idOrDate);
}

/**
 * Transforme CompletedDataFeedback → CompletedData
 */
function transformFeedbackToCompletedData(
    feedback: CompletedDataFeedback
): CompletedData {
    const sportType = feedback.sportType;

    return {
        actualDurationMinutes: feedback.actualDuration,
        distanceKm: feedback.distance,
        perceivedEffort: feedback.rpe,
        notes: feedback.notes,

        // Données optionnelles universelles
        heartRate: feedback.avgHeartRate ? {
            avgBPM: feedback.avgHeartRate,
            maxBPM: null // Pas collecté dans le formulaire pour l'instant
        } : undefined,
        caloriesBurned: feedback.calories ?? null,

        // Métriques sport-spécifiques
        metrics: {
            cycling: sportType === 'cycling' ? {
                tss: feedback.tss ?? null,
                avgPowerWatts: feedback.avgPower ?? null,
                maxPowerWatts: feedback.maxPower ?? null,
                normalizedPowerWatts: null, // Calculé ultérieurement si besoin
                avgCadenceRPM: feedback.avgCadence ?? null,
                maxCadenceRPM: feedback.maxCadence ?? null,
                elevationGainMeters: feedback.elevation ?? null,
                avgSpeedKmH: feedback.avgSpeed ?? null,
                maxSpeedKmH: feedback.maxSpeed ?? null
            } : null,

            running: sportType === 'running' ? {
                avgPaceMinPerKm: feedback.avgPace ?? null,
                bestPaceMinPerKm: null, // Pas collecté actuellement
                elevationGainMeters: feedback.elevation ?? null,
                avgCadenceSPM: feedback.avgCadence ?? null,
                maxCadenceSPM: feedback.maxCadence ?? null,
                avgSpeedKmH: feedback.avgSpeed ?? null,
                maxSpeedKmH: feedback.maxSpeed ?? null
            } : null,

            swimming: sportType === 'swimming' ? {
                avgPace100m: null, // Calculé depuis distance/duration si besoin
                bestPace100m: null,
                strokeType: feedback.strokeType ?? null,
                avgStrokeRate: feedback.avgStrokeRate ?? null,
                avgSwolf: feedback.avgSwolf ?? null,
                poolLengthMeters: feedback.poolLengthMeters ?? null,
                totalStrokes: feedback.totalStrokes ?? null
            } : null
        }
    };
}

/**
 * Met à jour le statut d'un workout avec feedback optionnel
 */
export async function updateWorkoutStatus(
    workoutIdOrDate: string,
    status: 'pending' | 'completed' | 'missed',
    feedback?: CompletedDataFeedback
): Promise<void> {
    try {
        const schedule = await getSchedule();
        const index = findWorkoutIndex(schedule.workouts, workoutIdOrDate);

        if (index === -1) {
            throw new Error(`Workout non trouvé: ${workoutIdOrDate}`);
        }

        // Mise à jour du statut
        schedule.workouts[index].status = status;

        // Gestion des données complétées
        if (status === 'completed' && feedback) {
            // Transformation type-safe
            schedule.workouts[index].completedData = transformFeedbackToCompletedData(feedback);
        } else {
            // Effacement si retour en pending/missed
            schedule.workouts[index].completedData = null;
        }

        // Sauvegarde
        await saveSchedule(schedule);
        revalidatePath('/');

    } catch (error) {
        console.error('Erreur updateWorkoutStatus:', error);
        throw error;
    }
}

/**
 * Alias pour clarté sémantique
 */
export async function completeWorkout(
    workoutIdOrDate: string,
    feedback: CompletedDataFeedback
): Promise<void> {
    return updateWorkoutStatus(workoutIdOrDate, 'completed', feedback);
}

/**
 * Marquer comme manqué
 */
export async function markWorkoutAsMissed(workoutIdOrDate: string): Promise<void> {
    return updateWorkoutStatus(workoutIdOrDate, 'missed');
}

/**
 * Réinitialiser en pending
 */
export async function resetWorkoutToPending(workoutIdOrDate: string): Promise<void> {
    return updateWorkoutStatus(workoutIdOrDate, 'pending');
}


export async function toggleWorkoutMode(workoutIdOrDate: string) {
    const schedule = await getSchedule();
    const index = findWorkoutIndex1(schedule.workouts, workoutIdOrDate);

    if (index !== -1) {
        const currentMode = schedule.workouts[index].mode;
        schedule.workouts[index].mode = currentMode === 'Outdoor' ? 'Indoor' : 'Outdoor';
        await saveSchedule(schedule);
        revalidatePath('/');
    }
}

export async function moveWorkout(originalDateOrId: string, newDateStr: string) {
    const schedule = await getSchedule();

    // 1. Trouver la source
    const sourceIndex = findWorkoutIndex1(schedule.workouts, originalDateOrId);
    if (sourceIndex === -1) throw new Error("Séance source non trouvée.");

    const sourceWorkout = schedule.workouts[sourceIndex];

    // 2. Vérifier s'il y a déjà une séance sur la date cible
    const targetIndex = schedule.workouts.findIndex(w => w.date === newDateStr);

    if (targetIndex !== -1) {
        // --- CAS 1 : ÉCHANGE (SWAP) ---
        const targetWorkout = schedule.workouts[targetIndex];
        
        // On échange les dates
        // Note: On reset à pending car changer de jour change le contexte
        schedule.workouts[sourceIndex] = {
             ...targetWorkout, 
             date: sourceWorkout.date, // Prend l'ancienne date de la source
             status: 'pending',
             completedData: null
        };

        schedule.workouts[targetIndex] = {
            ...sourceWorkout,
            date: newDateStr, // Prend la nouvelle date
            status: 'pending',
            completedData: null
        };
    } else {
        // --- CAS 2 : DÉPLACEMENT SIMPLE ---
        // On modifie juste la date de la source
        schedule.workouts[sourceIndex] = {
            ...sourceWorkout,
            date: newDateStr,
            status: 'pending',
            completedData: null
        };
    }

    await saveSchedule(schedule);
    revalidatePath('/');
}

export async function addManualWorkout(workout: Workout) {
    const schedule = await getSchedule();

    // ✅ Validation : vérifier que l'ID est unique (sécurité)
    const existingWorkout = schedule.workouts.find(w => w.id === workout.id);
    
    if (existingWorkout) {
        throw new Error(`Un workout avec l'ID ${workout.id} existe déjà`);
    }

    // ✅ Validation : vérifier le format de date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workout.date)) {
        throw new Error(`Format de date invalide: ${workout.date}. Attendu: YYYY-MM-DD`);
    }

    // ✅ Ajout du workout
    schedule.workouts.push(workout);

    await saveSchedule(schedule);
    revalidatePath('/');
}


export async function deleteWorkout(workoutIdOrDate: string) {
    const schedule = await getSchedule();

    // Filtrer pour exclure la séance ciblée
    const initialLength = schedule.workouts.length;
    schedule.workouts = schedule.workouts.filter(w => w.id !== workoutIdOrDate && w.date !== workoutIdOrDate);

    if (schedule.workouts.length !== initialLength) {
        await saveSchedule(schedule);
        revalidatePath('/');
    }
}
