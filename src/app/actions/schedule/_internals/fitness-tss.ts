/******************************************************************************
 * @file    _internals/fitness-tss.ts
 * @brief   Extraction du TSS d'une séance pour le recalcul CTL/ATL.
 *          Délègue à `getWorkoutTSS` (lib/stats/computeTSS) qui implémente la
 *          cascade par sport (puissance/allure → cardio → défaut sport).
 * @access  Module privé — ne pas importer depuis un composant client.
 ******************************************************************************/

import { Profile, Workout } from '@/lib/data/DatabaseTypes';
import { getWorkoutTSS } from '@/lib/stats/computeTSS';


/**
 * Renvoie le TSS d'une séance complétée pour le calcul CTL/ATL.
 *
 * Le TSS canonique est calculé une fois à l'écriture (import Strava ou saisie
 * manuelle) et stocké dans `cd.calculatedTSS` avec sa source `cd.tssSource`.
 * Pour les séances legacy sans `calculatedTSS`, le profil permet de recalculer
 * à la volée via la cascade unifiée.
 *
 * Ne retombe JAMAIS sur `plannedTSS` : un TSS planifié n'est pas une mesure
 * de la charge réellement encaissée et fausserait CTL/ATL.
 */
export function extractTSS(workout: Workout, profile?: Profile): number {
    return getWorkoutTSS(workout, profile);
}
