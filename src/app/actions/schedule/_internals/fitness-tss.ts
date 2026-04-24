/******************************************************************************
 * @file    _internals/fitness-tss.ts
 * @brief   Extraction robuste du TSS d'une séance avec cascade de fallback.
 * @access  Module privé — ne pas importer depuis un composant client.
 ******************************************************************************/

import { Profile, Workout } from '@/lib/data/DatabaseTypes';


/**
 * Extrait le TSS d'un workout complété.
 * Priorité :
 *   1. TSS vélo saisi / calculé via NP+FTP
 *   2. TSS calculé Strava (calculatedTSS)
 *   3. TSS planifié par l'IA
 *   4. hrTSS via FC moyenne + FCmax (+ FCrepos si dispo) — Karvonen
 *   5. Estimation sRPE : (durée_h) × (RPE/10)² × 100
 */
export function extractTSS(workout: Workout, profile?: Profile): number {
    const cd = workout.completedData;
    if (!cd) return 0;

    if (cd.metrics?.cycling?.tss) return cd.metrics.cycling.tss;
    if (cd.calculatedTSS)          return cd.calculatedTSS;
    if (workout.plannedData?.plannedTSS) return workout.plannedData.plannedTSS;

    // hrTSS via FC (méthode Karvonen si FCmax disponible dans le profil)
    const avgHR  = cd.heartRate?.avgBPM;
    const maxHR  = profile?.heartRate?.max;
    const duration = cd.actualDurationMinutes;
    if (avgHR != null && avgHR > 0 && maxHR != null && maxHR > 0 && duration) {
        const restHR   = profile?.heartRate?.resting ?? 0;
        const hrRatio  = restHR > 0
            ? (avgHR - restHR) / (maxHR - restHR)   // Karvonen (réserve cardiaque)
            : avgHR / maxHR;                          // Simplifié si pas de FCR
        const ifHR = Math.min(Math.max(hrRatio, 0), 1);
        return Math.round((duration / 60) * ifHR * ifHR * 100);
    }

    // Estimation sRPE : TSS ≈ (durée_h) × (RPE/10)² × 100
    const rpe = cd.perceivedEffort;
    if (rpe && duration && rpe > 0) {
        return Math.round((duration / 60) * Math.pow(rpe / 10, 2) * 100);
    }
    return 0;
}
