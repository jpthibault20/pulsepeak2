import { useMemo } from 'react';
import type { SportType } from '@/lib/data/type';
import { formatDateKey } from '@/lib/utils';
import { Schedule } from '@/lib/data/DatabaseTypes';

export interface WeekStats {
    plannedTSS: number;
    plannedDuration: number;
    actualDuration: number;
    distance: number;
    completed: number;
    total: number;
    completedTSS: number;
    sportBreakdown: Record<SportType, number>; // Nombre de séances
    sportDuration: Record<SportType, number>;  // ✅ NOUVEAU: Durée cumulée (minutes)
}
export function useWeekStats(
    weekDays: (Date | null)[],
    scheduleData: Schedule
): WeekStats {
    return useMemo(() => {
        const stats: WeekStats = {
            plannedTSS: 0,
            plannedDuration: 0,
            actualDuration: 0,
            distance: 0,
            completed: 0,
            completedTSS: 0,
            total: 0,
            sportBreakdown: { cycling: 0, running: 0, swimming: 0, other: 0  },
            sportDuration: { cycling: 0, running: 0, swimming: 0, other: 0  }
        };

        const uniqueDates = new Set(
            weekDays
                .filter((date): date is Date => date !== null)
                .map(date => formatDateKey(date))
        );

        scheduleData.workouts.forEach(workout => {
            if (!uniqueDates.has(workout.date)) return;

            stats.total++;
            stats.plannedTSS += workout.plannedData?.plannedTSS ?? 0;
            stats.plannedDuration += workout.plannedData?.durationMinutes ?? 0;

            if (stats.sportBreakdown[workout.sportType] !== undefined) {
                stats.sportBreakdown[workout.sportType]++;
            } else {
                stats.sportBreakdown[workout.sportType] = 1;
                stats.sportDuration[workout.sportType] = 0;
            }

            if (workout.status === 'completed' && workout.completedData) {
                stats.completed++;
                stats.actualDuration += workout.completedData.actualDurationMinutes;
                stats.distance += workout.completedData.distanceKm ?? 0;

                // TSS réalisé : priorité aux métriques cyclisme, sinon TSS calculé, sinon TSS planifié
                const cd = workout.completedData;
                const tss =
                    (cd.metrics?.cycling?.tss ?? 0) > 0 ? cd.metrics!.cycling!.tss! :
                    (cd.calculatedTSS ?? 0) > 0 ? cd.calculatedTSS! :
                    workout.plannedData?.plannedTSS ?? 0;
                stats.completedTSS += tss;

                if (stats.sportDuration[workout.sportType] !== undefined) {
                    stats.sportDuration[workout.sportType] += workout.completedData.actualDurationMinutes;
                } else {
                    stats.sportDuration[workout.sportType] = workout.completedData.actualDurationMinutes;
                }
            }
        });

        return stats;
    }, [weekDays, scheduleData.workouts]);
}
