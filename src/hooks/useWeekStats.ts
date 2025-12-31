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
    sportBreakdown: Record<SportType, number>; // Nombre de séances
    sportDuration: Record<SportType, number>;  // ✅ NOUVEAU: Durée cumulée (minutes)
}

export function useWeekStats(
    weekDays: (Date | null)[],
    scheduleData: Schedule
): WeekStats {
    return useMemo(() => {
        // 1. Initialiser la structure avec sportDuration
        const stats: WeekStats = {
            plannedTSS: 0,
            plannedDuration: 0,
            actualDuration: 0,
            distance: 0,
            completed: 0,
            total: 0,
            sportBreakdown: { cycling: 0, running: 0, swimming: 0 },
            sportDuration: { cycling: 0, running: 0, swimming: 0 } // ✅ Init à 0
        };

        weekDays.forEach(date => {
            if (!date) return;

            const dateKey = formatDateKey(date);
            const workouts = scheduleData.workouts.filter(w => w.date === dateKey);

            workouts.forEach(workout => {
                // Stats globales prévues
                stats.total++;
                stats.plannedTSS += workout.plannedData.plannedTSS ?? 0;
                stats.plannedDuration += workout.plannedData.durationMinutes;
                
                // Compte des séances par type
                // (On utilise (stats.sportBreakdown as any) si TypeScript rale sur des clés dynamiques manquantes, 
                // mais idéalement SportType correspond aux clés)
                if (stats.sportBreakdown[workout.sportType] !== undefined) {
                    stats.sportBreakdown[workout.sportType]++;
                } else {
                     // Fallback si un nouveau sport apparaît
                     stats.sportBreakdown[workout.sportType] = 1;
                     stats.sportDuration[workout.sportType] = 0;
                }

                // Stats Réalisées (Conditionnées au statut)
                if (workout.status === 'completed' && workout.completedData) {
                    stats.completed++;
                    stats.actualDuration += workout.completedData.actualDurationMinutes;
                    stats.distance += workout.completedData.distanceKm ?? 0;

                    // ✅ AJOUT : Cumul des minutes réalisées par sport
                    if (stats.sportDuration[workout.sportType] !== undefined) {
                        stats.sportDuration[workout.sportType] += workout.completedData.actualDurationMinutes;
                    } 
                }
            });
        });

        return stats;
    }, [weekDays, scheduleData.workouts]);
}
