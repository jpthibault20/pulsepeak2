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
            sportBreakdown: { cycling: 0, running: 0, swimming: 0  },
            sportDuration: { cycling: 0, running: 0, swimming: 0  }
        };

        const uniqueDates = new Set(
            weekDays
                .filter((date): date is Date => date !== null)
                .map(date => formatDateKey(date))
        );

        console.log('🔍 DEBUG - Dates de la semaine:', Array.from(uniqueDates));

        scheduleData.workouts.forEach(workout => {
            if (!uniqueDates.has(workout.date)) return;

            stats.total++;
            stats.plannedTSS += workout.plannedData.plannedTSS ?? 0;
            stats.plannedDuration += workout.plannedData.durationMinutes;

            if (stats.sportBreakdown[workout.sportType] !== undefined) {
                stats.sportBreakdown[workout.sportType]++;
            } else {
                stats.sportBreakdown[workout.sportType] = 1;
                stats.sportDuration[workout.sportType] = 0;
            }

            if (workout.status === 'completed' && workout.completedData) {
                stats.completed++;
                
                // 🐛 DEBUG CRITIQUE
                console.log('🔥 Workout complété:', {
                    date: workout.date,
                    sport: workout.sportType,
                    actualDurationMinutes: workout.completedData.actualDurationMinutes,
                    AVANT_actualDuration: stats.actualDuration,
                });

                stats.actualDuration += workout.completedData.actualDurationMinutes;

                console.log('✅ APRES_actualDuration:', stats.actualDuration);

                stats.distance += workout.completedData.distanceKm ?? 0;

                if (stats.sportDuration[workout.sportType] !== undefined) {
                    stats.sportDuration[workout.sportType] += workout.completedData.actualDurationMinutes;
                } else {
                    stats.sportDuration[workout.sportType] = workout.completedData.actualDurationMinutes;
                }
            }
        });

        console.log('📊 STATS FINALES:', {
            actualDuration: stats.actualDuration,
            completed: stats.completed,
            total: stats.total
        });

        return stats;
    }, [weekDays, scheduleData.workouts]);
}
