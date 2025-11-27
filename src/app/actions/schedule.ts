'use server';

// Import de la fonction generatePlanFromAI
import { generatePlanFromAI } from '@/lib/ai/coach-api'; 
import { getProfile, getSchedule, saveProfile, saveSchedule } from '@/lib/data/crud';
import { Schedule, Profile, Workout } from '@/lib/data/type'; 

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
export async function generateNewPlan(blockFocus: string, customTheme: string | null, startDate: string | null) {
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
            startDate // Passage de la date
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
    if (schedule.workouts[originalDateStr] && !schedule.workouts[newDateStr]) {
        const movedWorkout = { 
            ...schedule.workouts[originalDateStr], 
            date: newDateStr,
            status: 'pending' as const // Reset status
        };
        
        schedule.workouts[newDateStr] = movedWorkout;
        delete schedule.workouts[originalDateStr];

        await saveSchedule(schedule);
    } else {
         console.warn(`Impossible de déplacer la séance.`);
    }
}