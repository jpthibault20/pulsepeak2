import type { CompletedData, CompletedDataFeedback } from '@/lib/data/type';

export type MonthName = typeof MONTH_NAMES[number];
export type DayName = typeof DAY_NAMES_SHORT[number];

export const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
] as const;

export const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

export const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export function createCompletedData(feedback: CompletedDataFeedback): CompletedData {
  // 1. Base commune à tous les sports
  const baseData = {
    actualDurationMinutes: feedback.actualDuration,
    distanceKm: feedback.distance,
    perceivedEffort: feedback.rpe,
    notes: feedback.notes,
    
    // NOUVEAU : Champs obligatoires pour la compatibilité avec le type riche
    source: { type: 'manual' as const }, 
    laps: [], // Pas de tours détaillés en saisie manuelle
    map: { polyline: null }, // Pas de carte en saisie manuelle
    
    heartRate: {
      avgBPM: feedback.avgHeartRate ?? null,
      maxBPM: null, // Souvent inconnu en saisie rapide
      zoneDistribution: [], // Donnée non disponible manuellement
    },
    caloriesBurned: feedback.calories ?? null,
  };

  // 2. Logique spécifique par sport
  switch (feedback.sportType) {
    case 'cycling':
      return {
        ...baseData,
        metrics: {
          cycling: {
            tss: feedback.tss ?? null,
            avgPowerWatts: feedback.avgPower ?? null,
            normalizedPowerWatts: feedback.normalizedPower ?? null,
            maxPowerWatts: feedback.maxPower ?? null,
            intensityFactor: null, // Calculable si on avait la FTP, mais laissé null ici
            avgCadenceRPM: feedback.avgCadence ?? null,
            maxCadenceRPM: feedback.maxCadence ?? null,
            elevationGainMeters: feedback.elevation ?? null,
            avgSpeedKmH: feedback.avgSpeed ?? null,
            maxSpeedKmH: feedback.maxSpeed ?? null,
          },
          running: null,
          swimming: null,
        },
      };

    case 'running':
      return {
        ...baseData,
        metrics: {
          cycling: null,
          running: {
            avgPaceMinPerKm: feedback.avgPace ?? null,
            bestPaceMinPerKm: null,
            elevationGainMeters: feedback.elevation ?? null,
            avgCadenceSPM: feedback.avgCadence ?? null,
            maxCadenceSPM: feedback.maxCadence ?? null,
            avgSpeedKmH: feedback.avgSpeed ?? null,
            maxSpeedKmH: feedback.maxSpeed ?? null,
            strideLength: null, // Donnée technique avancée (Strava/Garmin uniquement)
          },
          swimming: null,
        },
      };

    case 'swimming':
      return {
        ...baseData,
        metrics: {
          cycling: null,
          running: null,
          swimming: {
            avgPace100m: feedback.avgPace ?? null, // Réutilisation du champ pace générique
            bestPace100m: null,
            strokeType: feedback.strokeType ?? null,
            avgStrokeRate: feedback.avgStrokeRate ?? null,
            avgSwolf: feedback.avgSwolf ?? null,
            poolLengthMeters: feedback.poolLengthMeters ?? null,
            totalStrokes: feedback.totalStrokes ?? null,
          },
        },
      };

    default:
      // Fallback de sécurité
      return {
        ...baseData,
        metrics: {
          cycling: null,
          running: null,
          swimming: null,
        },
      };
  }
}

export function formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Parse une date ISO "YYYY-MM-DD" en Date à minuit LOCAL (pas UTC).
 * À utiliser pour toute string date-only (block.startDate, objective.date, workout.date…)
 * afin d'éviter les décalages ±1 jour selon le fuseau horaire.
 *
 * Contraste avec :
 *   - new Date("2026-05-19") → UTC midnight (par spec ECMAScript)
 *   - date-fns v3+ parseISO("2026-05-19") → UTC midnight
 * Les deux donnent un Date qui, converti via toLocaleDateString dans un TZ négatif,
 * affiche le jour précédent. parseLocalDate évite ce piège.
 */
export function parseLocalDate(isoDate: string): Date {
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}` : `${mins}min`;
}
