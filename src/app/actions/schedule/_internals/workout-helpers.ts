/******************************************************************************
 * @file    _internals/workout-helpers.ts
 * @brief   Helpers partagés autour de la manipulation des workouts :
 *          résolution ID/Date et conversion formulaire → CompletedData.
 * @access  Module privé — ne pas importer depuis un composant client.
 ******************************************************************************/

import { CompletedData, CompletedDataFeedback } from '@/lib/data/type';
import { Workout } from '@/lib/data/DatabaseTypes';


/**
 * Trouve l'index d'un workout dans un tableau par ID ou par date (format YYYY-MM-DD).
 * Accepte les deux pour garder la rétro-compatibilité avec les anciens appelants.
 *
 * @returns l'index dans le tableau, ou -1 si introuvable
 */
export function findWorkoutIndex(workouts: Workout[], idOrDate: string): number {
    return workouts.findIndex(w => w.id === idOrDate || w.date === idOrDate);
}


/**
 * Transforme les données saisies par l'utilisateur dans le formulaire de
 * feedback (CompletedDataFeedback — majoritairement des strings) en objet
 * CompletedData canonique stocké en base (typé, normalisé en nombres).
 */
export function transformFeedbackToCompletedData(
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
