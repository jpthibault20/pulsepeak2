'use server';

// Import de la fonction generatePlanFromAI
import { generatePlanFromAI } from '@/lib/ai/coach-api'; 
import { getProfile, getSchedule, saveProfile, saveSchedule } from '@/lib/data/crud';
import { Schedule, Profile, Workout } from '@/lib/data/type'; 

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

// CORRECTION MAJEURE: Appel effectif à generatePlanFromAI
export async function generateNewPlan(blockFocus: string, customTheme: string | null) {
    console.log(`[Plan Generation] Focus: ${blockFocus}. Theme custom: ${customTheme}`);

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();

    if (!existingProfile) {
        throw new Error("Impossible de générer un plan sans profil athlète.");
    }
    
    // --- Préparez l'historique (simulation) ---
    // Vous devez ici générer une chaîne d'historique factice ou réelle.
    // Pour l'instant, utilisons une simulation simple de l'historique de l'athlète.
    const history = "L'athlète est en bonne forme. Dernière semaine : 10h de Z2, 3 séances d'intervalles (Z4/Z5). Pas de blessure. Cherche à monter en puissance.";

    
    try {
        // 1. Appel EFFECTIF à l'API Gemini
        const aiResponse = await generatePlanFromAI(
            existingProfile, 
            history, 
            blockFocus, 
            customTheme
        );
        
        // 2. Traitement et formatage des données de l'IA
        const nextWorkouts: { [key: string]: Workout } = {};
        
        aiResponse.workouts.forEach(w => {
            // Assurez-vous que l'objet Workout est complet selon le type
            nextWorkouts[w.date] = {
                ...w,
                status: 'pending', // Statut par défaut
            };
        });

        // 3. Construction du nouveau Schedule
        const newSchedule: Schedule = {
            // Fusionner les anciens et les nouveaux entraînements.
            // Les nouveaux écraseront les anciens si les dates se chevauchent.
            workouts: { ...existingSchedule.workouts, ...nextWorkouts },
            summary: aiResponse.synthesis, // Récupérer la synthèse de l'IA
            lastGenerated: new Date().toISOString().split('T')[0]
        };

        // 4. Sauvegarde
        await saveSchedule(newSchedule);

    } catch (error) {
        // Transmettre l'erreur au client pour affichage
        console.error("Échec de la génération de plan via l'IA:", error);
        throw new Error(`Échec de la génération du plan par l'IA. Vérifiez la console pour les détails. Détail: ${error}`);
    }
}

export async function updateWorkoutStatus(dateKey: string, status: 'pending' | 'completed' | 'missed', feedback?: { rpe: number, avgPower: number, notes: string }) {
    const schedule = await getSchedule();
    if (schedule.workouts[dateKey]) {
        schedule.workouts[dateKey].status = status;
        if (status === 'completed' && feedback) {
            schedule.workouts[dateKey].completedData = feedback;
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
        // Cloner la séance à la nouvelle date
        const movedWorkout: Workout = { 
            ...schedule.workouts[originalDateStr], 
            date: newDateStr, // Mise à jour de la date interne
            status: 'pending' // Réinitialiser le statut
        };
        schedule.workouts[newDateStr] = movedWorkout;

        // Supprimer l'original
        delete schedule.workouts[originalDateStr];

        await saveSchedule(schedule);
    } else {
         console.warn(`Impossible de déplacer la séance de ${originalDateStr} à ${newDateStr}. Cible occupée ou source manquante.`);
    }
}