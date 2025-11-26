'use server';

import { getProfile, getSchedule, saveProfile, saveSchedule } from '@/lib/data/crud';
import { Schedule, Profile, Workout } from '@/lib/data/type'; 

// --- Fonctions de lecture (initialisation)
// Cette fonction est désormais le seul point d'entrée pour les composants client
// souhaitant récupérer le profil et le calendrier, car elle est exécutée sur le serveur.
export async function loadInitialData(): Promise<{ profile: Profile | null, schedule: Schedule | null }> {
    try {
        // Ces appels sont sécurisés car ils sont exécutés sur le serveur
        const profile = await getProfile();
        const schedule = await getSchedule();
        return { profile, schedule };
    } catch (error) {
        console.error("Erreur lors du chargement initial des données:", error);
        return { profile: null, schedule: null };
    }
}


// --- Fonctions d'écriture (mutation)
// (Le code existant pour les actions d'écriture est maintenu ci-dessous)

export async function saveAthleteProfile(data: Profile) {
    await saveProfile(data);
}

export async function generateNewPlan(blockFocus: string, customTheme: string | null) {
    // Simuler la logique complexe de l'IA (qui utiliserait l'API Gemini pour générer le JSON)
    console.log(`[IA] Génération d'un plan axé sur: ${blockFocus}. Thème custom: ${customTheme}`);

    const existingSchedule = await getSchedule();
    const existingProfile = await getProfile();

    if (!existingProfile) {
        throw new Error("Impossible de générer un plan sans profil athlète.");
    }

    // Données fictives pour la démonstration
    const nextWeekWorkouts: { [key: string]: Workout } = {
        '2025-12-01': {
            date: '2025-12-01', title: 'Récupération Active', type: 'Recovery', duration: 45, tss: 30, status: 'pending', mode: 'Outdoor', 
            description_outdoor: '45 min de vélo en Zone 1 (55-70% FTP) sur terrain plat. Fréquence cardiaque basse et effort très léger. Concentrez-vous sur la fluidité du pédalage.',
            description_indoor: '45 min Z1 (55-70% FTP) sur Zwift. Maintenez une cadence > 90 RPM. Musique douce recommandée.',
        },
        '2025-12-02': {
            date: '2025-12-02', title: 'Seuil Intensif (2x20min)', type: 'Threshold', duration: 90, tss: 95, status: 'pending', mode: 'Indoor', 
            description_outdoor: 'Non recommandé en extérieur. À effectuer sur home trainer.',
            description_indoor: `Échauffement 20 min. Corps de séance: 2 x 20 min en Zone 4 (91-105% FTP, soit ${Math.round(existingProfile.ftp * 0.95)}W en moyenne). Récupération 5 min Z1. Terminer par 10 min Z1.`,
        },
        '2025-12-03': {
            date: '2025-12-03', title: 'Repos Complet', type: 'Rest', duration: 0, tss: 0, status: 'missed', mode: 'Outdoor', 
            description_outdoor: 'Repos complet.', description_indoor: 'Repos complet.',
        },
        '2025-12-04': {
            date: '2025-12-04', title: 'Rappel Force/Endurance', type: 'Tempo', duration: 60, tss: 50, status: 'pending', mode: 'Outdoor', 
            description_outdoor: '60 min. Inclure 4x5 min en Zone 3 (75-90% FTP) avec un gros braquet (cadence 60-70 RPM) pour la force.',
            description_indoor: '60 min. Inclure 4x5 min en Z3 (75-90% FTP) @ 65 RPM. Récupération 5 min Z1.',
        },
        '2025-12-07': {
            date: '2025-12-07', title: 'Longue Sortie Endurance', type: 'Endurance', duration: 180, tss: 150, status: 'pending', mode: 'Outdoor', 
            description_outdoor: '3 heures en Zone 2 (70-85% FTP). Maintenir l\'alimentation et l\'hydratation. Objectif: améliorer la capacité aérobie.',
            description_indoor: '3 heures Z2 sur Kinomap ou Rouvy. Varier les paysages pour éviter l\'ennui. Z2 = 70-85% FTP.',
        },
    };
    
    // Simuler un résumé IA basé sur le focus
    const summary = `Bloc de 3+1 axé sur le Seuil (Z4) et l'Endurance de Force pour préparer votre Gran Fondo. L'IA a planifié deux séances clés par semaine et respecte la disponibilité du ${existingProfile.name}.`;

    const newSchedule: Schedule = {
        workouts: { ...existingSchedule.workouts, ...nextWeekWorkouts },
        summary: summary,
        lastGenerated: new Date().toISOString().split('T')[0]
    };

    await saveSchedule(newSchedule);
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