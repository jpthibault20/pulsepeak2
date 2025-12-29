export const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// 📁 lib/utils/workoutHelpers.ts

import type { CompletedData, SportType } from '@/lib/data/type';

interface FeedbackInput {
  rpe: number;
  avgPower?: number;
 normalizedPower?: number;
  avgPace?: string;
  avgHeartRate?: number;
  actualDuration: number;
  distance: number;
  notes: string;
  sportType: SportType;
  // Optionnels selon le sport
  tss?: number | null;
  calories?: number | null;
  elevation?: number | null;
  avgCadence?: number | null;
  maxCadence?: number | null;
  avgSpeed?: number | null;
  maxSpeed?: number | null;
  maxPower?: number | null;
  strokeType?: string | null;
  avgStrokeRate?: number | null;
  avgSwolf?: number | null;
}

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
