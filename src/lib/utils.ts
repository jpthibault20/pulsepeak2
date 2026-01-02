import type { CompletedData, FeedbackInput } from '@/lib/data/type';

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

export function createCompletedData(feedback: FeedbackInput): CompletedData {
  const baseData = {
    actualDurationMinutes: feedback.actualDuration,
    distanceKm: feedback.distance,
    perceivedEffort: feedback.rpe,
    notes: feedback.notes,
    heartRate: {
      avgBPM: feedback.avgHeartRate ?? null,
      maxBPM: null,
    },
    caloriesBurned: feedback.calories ?? null,
  };

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
            avgSpeedKmH: feedback.avgSpeed ?? null, // ✅ AJOUTÉ
            maxSpeedKmH: feedback.maxSpeed ?? null, // ✅ AJOUTÉ
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
            avgPace100m: feedback.avgPace ?? null,
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
      // Fallback avec tous les metrics à null
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

export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h${mins > 0 ? mins.toString().padStart(2, '0') : ''}` : `${mins}min`;
}
