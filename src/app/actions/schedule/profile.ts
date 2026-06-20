/******************************************************************************
 * @file    profile.ts
 * @brief   Server Actions autour du profil utilisateur et du chargement
 *          initial des données affichées par la page principale.
 ******************************************************************************/

'use server';

import {
    getObjectives,
    getPlan,
    getProfile,
    getSchedule,
    saveProfile,
    saveTheme,
} from '@/lib/data/crud';
import { Objective, Profile, Schedule } from '@/lib/data/DatabaseTypes';


/** Forme minimale du plan actif exposée au client (pour la modale de confirmation). */
export interface ActivePlanSummary {
    id:   string;
    name: string;
}


/**
 * Charge en parallèle le profil, le schedule courant, les objectifs et un
 * résumé du plan actif (utilisé par AppClientWrapper pour décider d'afficher
 * la modale de confirmation de remplacement).
 * Utilisé au chargement de la page principale. Tolérant aux erreurs réseau :
 * retourne une forme vide plutôt que de lever.
 */
export async function loadInitialData(): Promise<{
    profile: Profile | null;
    schedule: Schedule | null;
    objectives: Objective[];
    activePlan: ActivePlanSummary | null;
}> {
    try {
        const [profile, schedule, objectives, plans] = await Promise.all([
            getProfile(),
            getSchedule(),
            getObjectives(),
            getPlan(),
        ]);
        const active = plans?.find(p => p.status === 'active') ?? null;
        const activePlan: ActivePlanSummary | null = active
            ? { id: active.id, name: active.name }
            : null;
        return { profile, schedule, objectives, activePlan };
    } catch (error) {
        console.error("Erreur lors du chargement initial des données:", error);
        return { profile: null, schedule: null, objectives: [], activePlan: null };
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
