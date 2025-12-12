'use server';

// Import de la fonction generatePlanFromAI
import { generatePlanFromAI, generateSingleWorkoutFromAI } from '@/lib/ai/coach-api';
import { getProfile, getSchedule, saveProfile, saveSchedule } from '@/lib/data/crud';
import { Schedule, Profile, Workout } from '@/lib/data/type';
import { revalidatePath } from 'next/cache';

// --- Helpers ---

// Calcul de l'historique pour le prompt AI
const getRecentPerformanceHistory = (schedule: Schedule): string => {
    const workouts = Object.values(schedule.workouts || {})
        .filter(w => w.status === 'completed' && w.completedData)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

    if (workouts.length === 0) return "Aucune donnée récente. (Premier bloc)";

    return workouts.map(w => {
        const data = w.completedData!;
        return `
      - Date: ${w.date}
      - Type: ${w.type} (Prévu: ${w.duration} min)
      - Réalisé: ${data.actualDuration || '?'} min | ${data.distance || '?'} km
      - RPE: ${data.rpe}/10 | Puissance: ${data.avgPower}W
      - Notes: "${data.notes || ''}"
    `}).join('\n');
};

// --- Fonctions de lecture (initialisation)
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


// --- Fonctions d'écriture (mutation)

export async function saveAthleteProfile(data: Profile) {
    await saveProfile(data);
}

// MISE À JOUR : Ajout du paramètre startDate (optionnel, string format YYYY-MM-DD)
export async function generateNewPlan(blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) {
    console.log(`[Plan Generation] Focus: ${blockFocus}. Theme custom: ${customTheme}. Start Date: ${startDate}`);

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();

    if (!existingProfile) {
        throw new Error("Impossible de générer un plan sans profil athlète.");
    }

    const history = getRecentPerformanceHistory(existingSchedule);

    try {
        // Appel à l'IA avec la date de début choisie
        const aiResponse = await generatePlanFromAI(
            existingProfile,
            history,
            blockFocus,
            customTheme,
            startDate,
            numWeeks
        );

        const nextWorkouts: { [key: string]: Workout } = {};

        aiResponse.workouts.forEach(w => {
            nextWorkouts[w.date] = {
                ...w,
                status: 'pending',
            } as Workout;
        });

        const newSchedule: Schedule = {
            workouts: { ...existingSchedule.workouts, ...nextWorkouts },
            summary: aiResponse.synthesis,
            lastGenerated: new Date().toISOString().split('T')[0]
        };

        await saveSchedule(newSchedule);

    } catch (error) {
        console.error("Échec de la génération de plan via l'IA:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Échec de la génération du plan par l'IA. Détail: ${errorMessage}`);
    }
}

export async function regenerateWorkout(dateKey: string, instruction?: string) {
    console.log(`[Workout Regeneration] Date: ${dateKey}, Instruction: ${instruction || 'None'}`);

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();

    if (!existingProfile) throw new Error("Profil manquant");

    const history = getRecentPerformanceHistory(existingSchedule);
    const surroundingWorkouts = getSurroundingWorkouts(existingSchedule, dateKey);
    const oldWorkout = existingSchedule.workouts[dateKey];

    // Valeur par défaut ou récupérée depuis le schedule
    const blockFocus = "General Fitness";

    try {
        const newWorkoutData = await generateSingleWorkoutFromAI(
            existingProfile,
            history,
            dateKey,
            surroundingWorkouts,
            oldWorkout,
            blockFocus,
            instruction // <--- ON PASSE L'ARGUMENT ICI
        );

        const replacementWorkout: Workout = {
            ...newWorkoutData,
            date: dateKey,
            status: 'pending',
            completedData: undefined
        };

        const newSchedule: Schedule = {
            ...existingSchedule,
            workouts: {
                ...existingSchedule.workouts,
                [dateKey]: replacementWorkout
            }
        };

        await saveSchedule(newSchedule);

    } catch (error) {
        console.error("Échec régénération:", error);
        throw new Error("L'IA n'a pas pu créer la séance.");
    }
}

// Helper pour donner du contexte à l'IA (jours avant/après)
function getSurroundingWorkouts(schedule: Schedule, targetDate: string) {
    const target = new Date(targetDate);
    const context: Record<string, string> = {}; // Date -> Titre/Type

    // On regarde 2 jours avant et 2 jours après
    for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const d = new Date(target);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        if (schedule.workouts[dateStr]) {
            context[dateStr] = `${schedule.workouts[dateStr].type} - ${schedule.workouts[dateStr].title}`;
        }
    }
    return context;
}

export async function updateWorkoutStatus(
    dateKey: string,
    status: 'pending' | 'completed' | 'missed',
    feedback?: { rpe: number, avgPower: number, notes: string, actualDuration: number, distance: number }
) {
    const schedule = await getSchedule();
    if (schedule.workouts[dateKey]) {
        schedule.workouts[dateKey].status = status;
        if (status === 'completed' && feedback) {
            schedule.workouts[dateKey].completedData = {
                ...feedback,
                actualDuration: Number(feedback.actualDuration), // S'assurer que ce sont des nombres si le type l'exige
                distance: Number(feedback.distance),
            };
        } else {
            delete schedule.workouts[dateKey].completedData;
        }
        await saveSchedule(schedule);
    }
}

export async function toggleWorkoutMode(dateKey: string) {
    const schedule = await getSchedule();
    if (schedule.workouts[dateKey]) {
        const currentMode = schedule.workouts[dateKey].mode;
        schedule.workouts[dateKey].mode = currentMode === 'Outdoor' ? 'Indoor' : 'Outdoor';
        await saveSchedule(schedule);
    }
}

export async function moveWorkout(originalDateStr: string, newDateStr: string) {
    const schedule = await getSchedule();

    // On récupère les deux séances potentielles
    const sourceWorkout = schedule.workouts[originalDateStr];
    const targetWorkout = schedule.workouts[newDateStr];

    if (!sourceWorkout) {
        throw new Error("Séance à déplacer non trouvée.");
    }

    // On prépare la version "déplacée" de la séance source
    // On réinitialise le statut à 'pending' car changer de date implique souvent de refaire la séance
    const movedSourceWorkout = {
        ...sourceWorkout,
        date: newDateStr,
        status: 'pending' as const,
        completedData: undefined
    };

    if (targetWorkout) {
        // --- CAS 1 : ÉCHANGE (SWAP) ---
        // Il y a déjà une séance à l'arrivée, on l'envoie à la date de départ
        const movedTargetWorkout = {
            ...targetWorkout,
            date: originalDateStr,
            status: 'pending' as const, // On réinitialise aussi celle-ci par précaution
            completedData: undefined
        };

        // Mise à jour de la map : A va en B, et B va en A
        schedule.workouts[newDateStr] = movedSourceWorkout;
        schedule.workouts[originalDateStr] = movedTargetWorkout;

    } else {
        // --- CAS 2 : DÉPLACEMENT SIMPLE ---
        // La case d'arrivée est vide
        schedule.workouts[newDateStr] = movedSourceWorkout;

        // On supprime l'ancienne entrée
        delete schedule.workouts[originalDateStr];
    }

    await saveSchedule(schedule);
    revalidatePath('/');
}
/**
 * Action 6: Ajouter manuellement une séance au calendrier
 */
export async function addManualWorkout(workout: Workout) {
    const schedule = await getSchedule();

    // On écrase s'il y a déjà quelque chose (ou on pourrait vérifier avant)
    schedule.workouts[workout.date] = workout;

    await saveSchedule(schedule);
    revalidatePath('/');
}

/**
 * Action 7: Supprimer une séance
 */
export async function deleteWorkout(dateKey: string) {
    const schedule = await getSchedule();

    if (schedule.workouts[dateKey]) {
        delete schedule.workouts[dateKey];
        await saveSchedule(schedule);
        revalidatePath('/');
    }
}