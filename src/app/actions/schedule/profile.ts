/******************************************************************************
 * @file    profile.ts
 * @brief   Server Actions autour du profil utilisateur et du chargement
 *          initial des données affichées par la page principale.
 ******************************************************************************/

'use server';

import {
    getObjectives,
    getProfile,
    getSchedule,
    saveProfile,
    saveTheme,
} from '@/lib/data/crud';
import { Objective, Profile, Schedule } from '@/lib/data/DatabaseTypes';


/**
 * Charge en parallèle le profil, le schedule courant et les objectifs.
 * Utilisé au chargement de la page principale. Tolérant aux erreurs réseau :
 * retourne une forme vide plutôt que de lever.
 */
export async function loadInitialData(): Promise<{
    profile: Profile | null;
    schedule: Schedule | null;
    objectives: Objective[];
}> {
    try {
        const [profile, schedule, objectives] = await Promise.all([
            getProfile(),
            getSchedule(),
            getObjectives(),
        ]);
        return { profile, schedule, objectives };
    } catch (error) {
        console.error("Erreur lors du chargement initial des données:", error);
        return { profile: null, schedule: null, objectives: [] };
    }
}


/** Persiste un profil athlète complet. */
export async function saveAthleteProfile(data: Profile) {
    await saveProfile(data);
}


/** Persiste la préférence de thème (dark / light). */
export async function saveThemePreference(theme: 'dark' | 'light') {
    await saveTheme(theme);
}
