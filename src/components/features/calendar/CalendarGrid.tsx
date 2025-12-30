import React, { useMemo } from 'react';
import type { Schedule, Workout } from '@/lib/data/type';
import { DayCell } from './DayCell';
import { WeekSummaryCell } from './WeekSummaryCell';
import { formatDateKey, DAY_NAMES_SHORT, type DayName } from '@/lib/utils';
import type { WeekStats } from '@/hooks/useWeekStats'; // Assurez-vous que ce type est exporté ou redéfini ici

interface CalendarGridProps {
    weekRows: (Date | null)[][];
    currentMonth: number;
    currentYear: number;
    scheduleData: Schedule;
    onOpenManualModal: (e: React.MouseEvent, date: Date) => void;
    onViewWorkout: (workout: Workout) => void;
}

export function CalendarGrid({
    weekRows,
    currentMonth,
    scheduleData,
    onOpenManualModal,
    onViewWorkout
}: CalendarGridProps) {

    const allWeekStats = useMemo(() => {
        return weekRows.map(week => {
            // 1. Initialisation complète obligatoire pour satisfaire TypeScript
            const stats = {
                plannedTSS: 0,
                plannedDuration: 0,
                actualDuration: 0,
                distance: 0,
                completed: 0,
                total: 0,
                // ✅ CORRECTION ICI : On initialise toutes les clés requises à 0
                sportBreakdown: {
                    cycling: 0,
                    running: 0,
                    swimming: 0
                } as Record<string, number> // 'as' permet un peu de souplesse si d'autres sports arrivent
            };

            week.forEach(date => {
                if (!date) return;

                const dateKey = formatDateKey(date);
                const workouts = scheduleData.workouts.filter(w => w.date === dateKey);

                workouts.forEach(workout => {
                    stats.total++;
                    stats.plannedTSS += workout.plannedData.plannedTSS ?? 0;
                    stats.plannedDuration += workout.plannedData.durationMinutes ?? 0;

                    // 2. Gestion sécurisée du comptage par sport
                    const sport = workout.sportType;
                    // On vérifie si la clé existe déjà, sinon on l'initialise (pour les sports non prévus comme 'musculation')
                    if (stats.sportBreakdown[sport] !== undefined) {
                        stats.sportBreakdown[sport]++;
                    } else {
                        // Cas où un sport inconnu arrive (fallback)
                        stats.sportBreakdown[sport] = 1;
                    }

                    if (workout.status === 'completed' && workout.completedData) {
                        stats.completed++;
                        stats.actualDuration += workout.completedData.actualDurationMinutes ?? 0;
                        stats.distance += workout.completedData.distanceKm ?? 0;
                    }
                });
            });

            return stats;
        });
    }, [weekRows, scheduleData.workouts]);

    return (
        <div className="flex flex-col rounded-xl overflow-hidden shadow-2xl bg-slate-950 border border-slate-800">

            {/* Header des jours */}
            <div className="grid grid-cols-8 bg-slate-900 border-b border-slate-800">
                {(DAY_NAMES_SHORT as readonly DayName[]).map((day) => (
                    <div
                        key={day}
                        className="py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest"
                    >
                        {day}
                    </div>
                ))}
                {/* Colonne Bilan distincte */}
                <div className="py-3 text-center text-[11px] font-bold text-blue-400/80 bg-slate-900/50 uppercase tracking-widest border-l border-slate-800">
                    Bilan
                </div>
            </div>

            {/* Corps du calendrier : Technique du gap-px pour des bordures fines */}
            <div className="bg-slate-800 gap-px grid border-b border-slate-800 last:border-0">
                {weekRows.map((week, weekIndex) => {
                    const stats = allWeekStats[weekIndex];

                    return (
                        <div key={weekIndex} className="grid grid-cols-8 group">
                            {/* Les 7 jours de la semaine */}
                            {week.map((date, dayIndex) => {
                                // Cellule vide (début/fin de mois hors grille)
                                if (!date) {
                                    return (
                                        <div
                                            key={`empty-${weekIndex}-${dayIndex}`}
                                            className="bg-slate-950/80 min-h-[120px]"
                                        />
                                    );
                                }

                                const dateKey = formatDateKey(date);
                                const workouts = scheduleData.workouts.filter(w => w.date === dateKey);
                                const isCurrentMonth = date.getMonth() === currentMonth;
                                const isToday = formatDateKey(date) === formatDateKey(new Date());

                                return (
                                    <div
                                        key={dateKey}
                                        className={`
                                            min-h-[120px] relative transition-colors duration-200
                                            ${!isCurrentMonth ? 'bg-slate-950/60' : 'bg-slate-900 hover:bg-slate-800'}
                                            ${isToday ? 'ring-inset ring-1 ring-blue-500/30 bg-blue-500/5' : ''}
                                        `}
                                    >
                                        <DayCell
                                            date={date}
                                            workouts={workouts}
                                            isCurrentMonth={isCurrentMonth}
                                            isToday={isToday}
                                            onOpenManualModal={onOpenManualModal}
                                            onViewWorkout={onViewWorkout}
                                        />
                                    </div>
                                );
                            })}

                            {/* La cellule de résumé de la semaine (8ème colonne) */}
                            <div className="bg-slate-900/40 min-h-[120px] relative border-l border-slate-800/50 hover:bg-slate-900/80 transition-colors">
                                <WeekSummaryCell stats={stats} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
