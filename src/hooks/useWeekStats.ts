import { useMemo } from 'react';
import type { Schedule, SportType } from '@/lib/data/type';
import { formatDateKey } from '@/lib/utils';

export interface WeekStats {
    plannedTSS: number;
    plannedDuration: number;
    actualDuration: number;
    distance: number;
    completed: number;
    total: number;
    sportBreakdown: Record<SportType, number>;
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
            total: 0,
            sportBreakdown: { cycling: 0, running: 0, swimming: 0 }
        };

        weekDays.forEach(date => {
            if (!date) return;
            
            const dateKey = formatDateKey(date);
            const workouts = scheduleData.workouts.filter(w => w.date === dateKey);

            workouts.forEach(workout => {
                stats.total++;
                stats.plannedTSS += workout.plannedData.plannedTSS ?? 0;
                stats.plannedDuration += workout.plannedData.durationMinutes;
                stats.sportBreakdown[workout.sportType]++;

                if (workout.status === 'completed' && workout.completedData) {
                    stats.completed++;
                    stats.actualDuration += workout.completedData.actualDurationMinutes;
                    stats.distance += workout.completedData.distanceKm ?? 0;
                }
            });
        });

        return stats;
    }, [weekDays, scheduleData.workouts]);
}
