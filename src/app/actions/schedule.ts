'use server';

// Import de la fonction generatePlanFromAI
import { generatePlanFromAI, generateSingleWorkoutFromAI } from '@/lib/ai/coach-api';
import { getBlock, getPlan, getProfile, getSchedule, getWeek, saveBlocks, savePlan, saveProfile, saveSchedule, saveWeek } from '@/lib/data/crud';
import { Workoutold } from '@/lib/data/type';
import { revalidatePath } from 'next/cache';
// lib/actions/workoutActions.ts
import type { CompletedData, CompletedDataFeedback } from '@/lib/data/type';

import fs from 'fs/promises';
import path from 'path';
import { getStravaActivities, getStravaActivityById } from '@/lib/strava-service';
import { mapStravaToCompletedData } from '@/lib/strava-mapper';
import { Block, Plan, Profile, Schedule, Week } from '@/lib/data/DatabaseTypes';
import { randomUUID } from 'crypto';
import {
    differenceInWeeks,
    addWeeks,
    startOfISOWeek,
    endOfISOWeek,
    format
} from 'date-fns';
import { callGeminiAPI } from '@/lib/ai/coach-api';




/******************************************************************************
 * function: CreateNewPlan
 * brrief: Création d'un nouveau training plan basé sur les inputs de l'utilisateur.
 * input: 
 * - blockFocus: Nom du bloc de séance
 * - customTheme: Thème personnalisé pour le bloc de séance
 * - startDate: Date de début du plan
 * - numWeeks: Nombre de semaines pour le plan
 * - userID: ID de l'utilisateur
 * output: 
 * - plan
 ******************************************************************************/
export async function CreateNewPlan(
    blockFocus: string,
    customTheme: string | null,
    startDate: string,
    numWeeks: number,
    userID: string
) {
    const existingPlan = await getPlan();
    const Profile = await getProfile();

    // Calculer la date de fin
    const goalDate = new Date(startDate);
    goalDate.setDate(goalDate.getDate() + (numWeeks * 7));

    const newPlan: Plan = {
        id: randomUUID(),
        userID,
        blocksID: [],
        name: blockFocus,
        startDate,
        goalDate: goalDate.toISOString().split('T')[0],
        macroStrategyDescription: customTheme || blockFocus,
        status: "active"
    };

    // Combiner les plans existants avec le nouveau
    const allPlans = Array.isArray(existingPlan)
        ? [...existingPlan, newPlan]
        : [newPlan];


const result = await generatBlocks(newPlan, Profile);
const blockIds = result.map((block: Block) => block.id);

const updatedPlan = {
  ...newPlan,
  blocksID: blockIds,
};

// Remplacer le plan dans allPlans
const updatedAllPlans = allPlans.map((plan) =>
  plan.id === newPlan.id ? updatedPlan : plan
);

await savePlan(updatedAllPlans);
}

/******************************************************************************
 * function: createBlock
 * brrief: Création des différents blocs pour arriver a l'objectif du plan.
 * input: 
 * - userID: ID de l'utilisateur
 * - planID: ID du plan
 * output: 
 * - blocks[]
 ******************************************************************************/
export async function generatBlocks(plan: Plan, profile: Profile) {

    // 1. Initialisation des dates
    const start = startOfISOWeek(new Date(plan.startDate));
    const goal = endOfISOWeek(new Date(plan.goalDate));
    const totalWeeks = differenceInWeeks(goal, start) + 1;

    if (totalWeeks < 1) throw new Error("Le plan est trop court !");

    // 2. Découpage en blocs
    const blockSkeletons: { index: number; duration: number; isLast: boolean }[] = [];
    let weeksRemaining = totalWeeks;
    let index = 1;

    while (weeksRemaining > 0) {
        let duration = 4;
        if (weeksRemaining <= 5) {
            duration = weeksRemaining;
            weeksRemaining = 0;
            blockSkeletons.push({ index, duration, isLast: index === 1 ? false : true });
        } else {
            blockSkeletons.push({ index, duration, isLast: false });
            weeksRemaining -= 4;
        }
        index++;
    }
// @TODO: remplacer les spécification au cyclisme en adaptatif au triathlon 
    const aiPrompt = `
Tu es un coach de ${"cyclisme"}, certifié avec 15 ans d'expérience dans le domaine.

## CONTEXTE ATHLÈTE
- Objectif : ${plan.macroStrategyDescription}
- Date de course : ${plan.goalDate}
- Niveau : ${profile.experience ?? "Intermédiaire"} 
- Volume hebdo actuel : ${"Non spécifié"}h
- Discipline faible : ${"Non spécifié"}

## STRUCTURE TEMPORELLE
${blockSkeletons.length} blocs de méso-cycles :
${blockSkeletons.map(b =>
        `- Bloc ${b.index} : ${b.duration} semaines${b.isLast ? " (DERNIER → inclut la semaine de course)" : ""}`
    ).join('\n')}

## RÈGLES OBLIGATOIRES
1. tu dois prendre en compte le profil de l'athlète et son objectif pour définir un thème spécifique à chaque bloc 
2. tu dois prendre en compte l'historique a disposition pour s'adapter au mieux a l'athlète
3. Dans le mesure du possible suivre une progression logique progressive et pertinente
4. Si il n'y a qu'un seul bloc, part du principe que l'athlète a déjà une base et qu'on est dans une logique de préparation spécifique (pas de bloc de base sauf si demandé)


Chaque objet contient exactement :
- "index" (number) : numéro du bloc
- "type" (string) : l'un de ["Base", "Build", "Peak", "Taper"]
- "theme" (string) : objectif principal en 3 à 6 mots, spécifique à ${"cyclisme"}

## RÉPONSE (JSON uniquement) :
`;


    const aiResponse = await callGeminiAPI({
        contents: [
            {
                parts: [{ text: aiPrompt }]
            }
        ],
        generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
        },
    }) as { index: number; type: string; theme: string }[];

    // 4. Création des blocs avec CTL progressive
    const oldBlocks = await getBlock();

    const blocksToSave: Block[] = [];
    let currentBlockStartDate = start;
    let previousTargetCTL = profile.currentCTL; // Point de départ = CTL actuelle du profil

    for (const skeleton of blockSkeletons) {
        const aiInfo = aiResponse.find(b => b.index === skeleton.index);

        // Progression CTL selon le type de bloc
        const ctlProgression: Record<string, number> = {
            Base:    5, 
            Build:   10,
            Peak:    5, 
            Taper:  -15,
        };
        const progression = ctlProgression[aiInfo?.type ?? "Base"] ?? 5;

        const startCTL = previousTargetCTL;
        const targetCTL = startCTL + progression;
        const avgWeeklyTSS = Math.round(((startCTL + targetCTL) / 2) * 7); // CTL moy * 7j

        const newBlock: Block = {
            id: randomUUID(),
            planId: plan.id,
            userId: plan.userID,
            orderIndex: skeleton.index,
            type: aiInfo?.type || "General",
            theme: aiInfo?.theme || "Préparation",
            weekCount: skeleton.duration,
            startDate: format(currentBlockStartDate, 'yyyy-MM-dd'),
            weeksId: [],
            startCTL,
            targetCTL,
            avgWeeklyTSS,
        };

        blocksToSave.push(newBlock);
        previousTargetCTL = targetCTL; // Le prochain bloc part d'où celui-ci s'arrête
        currentBlockStartDate = addWeeks(currentBlockStartDate, skeleton.duration);
    }

    // 5. Génération des semaines
    const oldWeeks = await getWeek();

    let allNewWeeks: Week[] = Array.isArray(oldWeeks) ? [...oldWeeks] : [];

const updatedBlocks = await Promise.all(
    blocksToSave.map(async (block) => {
        const resultWeeks = await generatWeeks(plan, block, profile);
        const weeksArray = Array.isArray(resultWeeks) ? resultWeeks : [resultWeeks];

        allNewWeeks = [...allNewWeeks, ...weeksArray];

        return {
            ...block,
            weeksId: [...block.weeksId, ...weeksArray.map(w => w.id)],
        };
    })
);

await saveWeek(allNewWeeks);
await saveBlocks([
    ...Array.isArray(oldBlocks) ? oldBlocks : [],
    ...updatedBlocks
]);
    return updatedBlocks;
}

/******************************************************************************
 * function: createWeeks
 * brrief: Création des différentes semaines.
 * input: 
 * - user: utilisateur
 * - plan: plan
 * output: 
 * - weeks
 ******************************************************************************/
export async function generatWeeks(plan: Plan, block: Block, profile: Profile): Promise<Week[]> {
    const weeks: Week[] = await Promise.all(
        Array.from({ length: block.weekCount }, async (_, i) => {
            /* provisoire */
            const weekNumber = i + 1;
            const isLastWeek = weekNumber === block.weekCount;
            const baseTSS = 200;
            const progressionPerWeek = 20;

            const week: Week = {
                id: randomUUID(),
                userID: profile.id,
                workoutsID: [],
                blockID: block.id,
                weekNumber,
                type: isLastWeek ? 'Recovery' : 'Load',
                targetTSS: isLastWeek
                    ? baseTSS + progressionPerWeek * (weekNumber - 1) - 20
                    : baseTSS + progressionPerWeek * (weekNumber - 1),
                actualTSS: 0,
                userFeedback: "Test développement !",
            };

            return week;
        })
    );

    return weeks;
}































const DB_PATH = path.join(process.cwd(), 'src/lib/data/tables/schedule.json');

// --- Helpers ---

const getRecentPerformanceHistory = (schedule: Schedule): string => {
    // Sécurité: vérifier que schedule.workouts est un tableau
    const allWorkouts = Array.isArray(schedule.workouts) ? schedule.workouts : [];

    // On récupère les 10 dernières séances complétées, du plus récent au plus ancien
    const workouts = allWorkouts
        .filter(w => w.status === 'completed' && w.completedData)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    if (workouts.length === 0) return "Aucune donnée historique récente disponible.";

    return workouts.map(w => {
        const data = w.completedData!;
        const metrics = data.metrics;
        const plannedDuration = w.plannedData?.durationMinutes || '?';

        // Construction des détails spécifiques au sport
        const performanceDetails = [];

        // 1. Métriques Spécifiques par Sport
        if (w.sportType === 'cycling' && metrics.cycling) {
            if (metrics.cycling.avgPowerWatts) performanceDetails.push(`${metrics.cycling.avgPowerWatts}W Avg`);
            if (metrics.cycling.normalizedPowerWatts) performanceDetails.push(`${metrics.cycling.normalizedPowerWatts}W NP`);
        }
        else if (w.sportType === 'running' && metrics.running) {
            if (metrics.running.avgPaceMinPerKm) performanceDetails.push(`${metrics.running.avgPaceMinPerKm}/km`);
            if (metrics.running.elevationGainMeters) performanceDetails.push(`D+ ${metrics.running.elevationGainMeters}m`);
            if (metrics.cycling?.tss) performanceDetails.push(`TSS: ${metrics.cycling?.tss}`);
        }
        else if (w.sportType === 'swimming' && metrics.swimming) {
            if (metrics.swimming.avgPace100m) performanceDetails.push(`${metrics.swimming.avgPace100m}/100m`);
            if (metrics.swimming.strokeType) performanceDetails.push(`Nage: ${metrics.swimming.strokeType}`);
        }

        // 2. Données Physiologiques & Charge (Communs)
        const physioDetails = [];
        if (data.heartRate?.avgBPM) physioDetails.push(`FC Moy: ${data.heartRate.avgBPM}bpm`);

        // Assemblage des chaines pour l'affichage
        const perfString = performanceDetails.length > 0 ? `| Perf: [${performanceDetails.join(', ')}]` : '';
        const physioString = physioDetails.length > 0 ? `| Physio: [${physioDetails.join(', ')}]` : '';

        // Formatage pour l'IA : Conis et structuré
        return `
      - [${w.date}] ${w.sportType.toUpperCase()} - ${w.workoutType}
        * Durée: Prévue ${plannedDuration}m vs Réelle ${data.actualDurationMinutes}m
        * Volume: ${data.distanceKm.toFixed(2)} km ${perfString}
        * Intensité/Ressenti: RPE ${data.perceivedEffort}/10 ${physioString}
        * Notes: "${data.notes || 'R.A.S'}"
    `.trim();
    }).join('\n\n');
};




// Helper pour trouver une séance par ID ou par Date (pour rétro-compatibilité)
const findWorkoutIndex1 = (workouts: Workoutold[], identifier: string): number => {
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


export async function generateNewPlanOld(blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) {
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
function findWorkoutIndex(workouts: Workoutold[], idOrDate: string): number {
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
        actualDurationMinutes: Number(feedback.actualDuration),
        distanceKm: feedback.distance ? Number(feedback.distance) : 0,
        perceivedEffort: Number(feedback.rpe),
        notes: feedback.notes || "", // Chaîne vide si null

        source: {
            type: 'manual',
            stravaId: null // Pas de champ pour le moment
        },

        laps: [], // Pas de tours détaillés en saisie manuelle

        // Toujours renvoyer l'objet structurel, champs à null si pas de donnée
        heartRate: {
            avgBPM: feedback.avgHeartRate ? Number(feedback.avgHeartRate) : null,
            maxBPM: null // Valeur explicite null
        },

        caloriesBurned: feedback.calories ? Number(feedback.calories) : null,

        // Métriques sport-spécifiques
        metrics: {
            cycling: sportType === 'cycling' ? {
                tss: feedback.tss ? Number(feedback.tss) : null,
                avgPowerWatts: feedback.avgPower ? Number(feedback.avgPower) : null,
                maxPowerWatts: feedback.maxPower ? Number(feedback.maxPower) : null,
                normalizedPowerWatts: null, // On garde la clé présente
                intensityFactor: null,      // Souvent requis dans le type CyclingMetrics
                avgCadenceRPM: feedback.avgCadence ? Number(feedback.avgCadence) : null,
                maxCadenceRPM: feedback.maxCadence ? Number(feedback.maxCadence) : null,
                elevationGainMeters: feedback.elevation ? Number(feedback.elevation) : null,
                avgSpeedKmH: feedback.avgSpeed ? Number(feedback.avgSpeed) : null,
                maxSpeedKmH: feedback.maxSpeed ? Number(feedback.maxSpeed) : null,
            } : null,

            running: sportType === 'running' ? {
                avgPaceMinPerKm: feedback.avgPace ? feedback.avgPace : null,
                bestPaceMinPerKm: null,
                elevationGainMeters: feedback.elevation ? Number(feedback.elevation) : null,
                avgCadenceSPM: feedback.avgCadence ? Number(feedback.avgCadence) : null,
                maxCadenceSPM: feedback.maxCadence ? Number(feedback.maxCadence) : null,
                avgSpeedKmH: feedback.avgSpeed ? Number(feedback.avgSpeed) : null,
                maxSpeedKmH: feedback.maxSpeed ? Number(feedback.maxSpeed) : null
            } : null,

            swimming: sportType === 'swimming' ? {
                avgPace100m: null,
                bestPace100m: null,
                strokeType: feedback.strokeType ?? null, // String ou Enum, pas de Number()
                avgStrokeRate: feedback.avgStrokeRate ? Number(feedback.avgStrokeRate) : null,
                avgSwolf: feedback.avgSwolf ? Number(feedback.avgSwolf) : null,
                poolLengthMeters: feedback.poolLengthMeters ? Number(feedback.poolLengthMeters) : null,
                totalStrokes: feedback.totalStrokes ? Number(feedback.totalStrokes) : null
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

export async function addManualWorkout(workout: Workoutold) {
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

export async function syncStravaActivities() {
    console.log("⚡ Début Sync Strava...");

    try {
        // 1. Charger la DB actuelle
        const data = await fs.readFile(DB_PATH, 'utf-8');
        const schedule: Schedule = JSON.parse(data);

        // 2. Trouver la date de la dernière activité Strava importée
        let lastStravaTimestamp = 0;

        // On regarde toutes les activités complétées qui viennent de Strava
        const stravaWorkouts = schedule.workouts.filter(w =>
            w.status === 'completed' &&
            w.completedData?.source?.type === 'strava'
        );

        if (stravaWorkouts.length > 0) {
            // Trier par date pour trouver la plus récente
            stravaWorkouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const lastWorkout = stravaWorkouts[0];
            // On convertit la date en Timestamp UNIX (secondes) pour Strava
            // On ajoute un buffer de quelques heures pour être sûr (ou on prend la date exacte)
            lastStravaTimestamp = Math.floor(new Date(lastWorkout.date).getTime() / 1000);
            console.log(`📅 Dernière activité Strava connue : ${lastWorkout.date} (Epoch: ${lastStravaTimestamp})`);
        } else {
            console.log("⚠️ Aucune activité Strava trouvée en DB. Récupération des 20 dernières.");
        }

        // 3. Appeler Strava API
        // Si lastStravaTimestamp est 0, on envoie null, Strava renverra les plus récents par défaut
        const activitiesSummary = await getStravaActivities(
            lastStravaTimestamp > 0 ? lastStravaTimestamp : null,
            20 // Max items à sync d'un coup
        );

        if (!activitiesSummary || activitiesSummary.length === 0) {
            console.log("✅ Aucune nouvelle activité à synchroniser.");
            return { success: true, count: 0 };
        }

        console.log(`📥 ${activitiesSummary.length} nouvelles activités détectées.`);

        let newItemsCount = 0;

        // 4. Traiter chaque activité (Boucle)
        for (const summary of activitiesSummary) {

            // Vérification de doublon (par ID Strava)
            const exists = schedule.workouts.some(w =>
                w.completedData?.source?.type === 'strava' &&
                w.completedData.source.stravaId === summary.id
            );

            if (exists) {
                console.log(`   ⏭  Skip: Activité ${summary.id} déjà présente.`);
                continue;
            }

            // 📝 Récupération du DÉTAIL (pour avoir les LAPS)
            // C'est ici qu'on fait l'appel API individuel
            const detail = await getStravaActivityById(summary.id);
            if (!detail) continue;

            const completedData = await mapStravaToCompletedData(detail);
            const activityDate = summary.start_date.split('T')[0]; // YYYY-MM-DD

            // 🧠 LOGIQUE DE MATCHING : Est-ce qu'un entrainement était prévu ce jour-là ?
            // On cherche un workout à "pending" ou "missed" à cette date
            const unplannedId = `strava_${summary.id}`; // ID temporaire par défaut

            const matchingIndex = schedule.workouts.findIndex(w =>
                w.date === activityDate &&
                w.status !== 'completed' // On n'écrase pas un truc déjà fait
            );

            if (matchingIndex !== -1) {
                // MATCH TROUVÉ : On met à jour l'entrainement prévu
                console.log(`   🤝 Match trouvé pour le ${activityDate} -> Mise à jour du plan.`);
                schedule.workouts[matchingIndex].status = 'completed';
                schedule.workouts[matchingIndex].completedData = completedData;
                // Optionnel : On peut renommer le titre ou garder le titre Strava
                // schedule.workouts[matchingIndex].title = detail.name; 
            } else {
                // PAS DE MATCH : On crée une nouvelle entrée "Activité Libre"
                console.log(`   ➕ Nouvelle activité libre ajoutée : ${activityDate}`);
                const newWorkout: Workoutold = {
                    id: unplannedId,
                    date: activityDate,
                    sportType: completedData.metrics.running ? 'running' : 'cycling', // Simplifié
                    title: detail.name, // Titre Strava
                    workoutType: 'Sortie Libre',
                    mode: 'Outdoor', // Hypothèse par défaut
                    status: 'completed',
                    plannedData: { // Pas de plan, donc vide
                        durationMinutes: 0,
                        targetPowerWatts: null,
                        targetPaceMinPerKm: null,
                        targetHeartRateBPM: null,
                        distanceKm: null,
                        plannedTSS: null,
                        descriptionOutdoor: null,
                        descriptionIndoor: null
                    },
                    completedData: completedData
                };
                schedule.workouts.push(newWorkout);
            }
            newItemsCount++;
        }

        // 5. Sauvegarder si changements
        if (newItemsCount > 0) {
            // Re-trier le calendrier par date pour garder l'ordre
            schedule.workouts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            await fs.writeFile(DB_PATH, JSON.stringify(schedule, null, 2));
            console.log("💾 DB mise à jour avec succès.");
        }

        return { success: true, count: newItemsCount };

    } catch (error) {
        console.error("❌ Erreur Sync Strava:", error);
        return { success: false, error: error };
    }
}