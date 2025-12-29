'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
    Clock, Zap, Home, Mountain,
    ChevronLeft, ChevronRight, CheckCircle, XCircle,
    BrainCircuit, Plus, Info, Bike, User as Running, Waves
} from 'lucide-react';
import type { Workout, Schedule, SportType } from '@/lib/data/type';
import { Button } from '@/components/ui/Button';
import { ManualWorkoutModal } from '../workout/ManualWorkoutModal';
import { GenerationModal } from './GenerationModal';

// --- Types ---
interface CalendarViewProps {
    scheduleData: Schedule;
    onViewWorkout: (workout: Workout) => void;
    onGenerate: (
        blockFocus: string,
        customTheme: string | null,
        startDate: string | null,
        numWeeks?: number
    ) => Promise<void>;
    onAddManualWorkout: (workout: Workout) => Promise<void>;
}

interface WeekStats {
    plannedTSS: number;
    plannedDuration: number;
    actualDuration: number;
    distance: number;
    completed: number;
    total: number;
    sportBreakdown: Record<SportType, number>;
}

// --- Constantes ---
const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
] as const;

const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const;

const SPORT_CONFIG: Record<SportType, { icon: React.ReactNode; color: string; bgColor: string }> = {
    cycling: {
        icon: <Bike size={14} />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10'
    },
    running: {
        icon: <Running size={14} />,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/10'
    },
    swimming: {
        icon: <Waves size={14} />,
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/10'
    }
};

// --- Component ---
export function CalendarView({
    scheduleData,
    onViewWorkout,
    onGenerate,
    onAddManualWorkout
}: CalendarViewProps) {
    // --- State ---
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showManualModal, setShowManualModal] = useState(false);
    const [showGenModal, setShowGenModal] = useState(false);
    const [dateForManual, setDateForManual] = useState<Date | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    // --- Helpers ---
    const formatDateKey = (date: Date | null): string => {
        if (!date) return '';
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getWorkoutsForDate = useCallback((date: Date | null): Workout[] => {
        if (!date) return [];
        const key = formatDateKey(date);
        return scheduleData.workouts.filter(w => w.date === key);
    }, [scheduleData.workouts]);

    const formatDuration = (mins: number): string => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
    };

    // --- Semaines du mois ---
    const weekRows = useMemo(() => {
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const weekRows: (Date | null)[][] = [];
        let currentWeek: (Date | null)[] = new Array(firstDay).fill(null);

        for (let i = 1; i <= daysInMonth; i++) {
            currentWeek.push(new Date(year, month, i));
            if (currentWeek.length === 7) {
                weekRows.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push(null);
            weekRows.push(currentWeek);
        }

        return weekRows;
    }, [year, month]);

    // --- Stats Hebdo ---
    const getWeekStats = useCallback((weekDays: (Date | null)[]): WeekStats => {
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
            const workouts = getWorkoutsForDate(date);
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
    }, [getWorkoutsForDate]);

    // --- Handlers ---
    const handleGeneratePlan = useCallback(async (
        blockFocus: string,
        customTheme: string | null,
        startDate: string | null,
        numWeeks?: number
    ) => {
        setIsGenerating(true);
        try {
            await onGenerate(blockFocus, customTheme, startDate, numWeeks);
        } finally {
            setIsGenerating(false);
        }
    }, [onGenerate]);

    const handleOpenManualModal = useCallback((e: React.MouseEvent, date: Date) => {
        e.stopPropagation();
        setDateForManual(date);
        setShowManualModal(true);
    }, []);

    const handleSaveManual = useCallback(async (workout: Workout) => {
        await onAddManualWorkout(workout);
        setShowManualModal(false);
    }, [onAddManualWorkout]);

    const handlePrevMonth = useCallback(() => {
        setSelectedDate(new Date(year, month - 1));
    }, [year, month]);

    const handleNextMonth = useCallback(() => {
        setSelectedDate(new Date(year, month + 1));
    }, [year, month]);

    // --- Render Workout Card ---
    const renderWorkoutCard = (workout: Workout, isCompact: boolean = false) => {
        const sportConfig = SPORT_CONFIG[workout.sportType];
        const duration = formatDuration(workout.plannedData.durationMinutes);
        const tss = workout.plannedData.plannedTSS ?? 0;

        return (
            <div
                onClick={() => onViewWorkout(workout)}
                className={`
                    relative group cursor-pointer transition-all
                    ${isCompact ? 'p-2' : 'p-3'}
                    bg-slate-800/60 hover:bg-slate-800 
                    border border-slate-700/50 hover:border-slate-600
                    rounded-lg
                `}
            >
                {/* Header : Sport + Status */}
                <div className="flex items-start justify-between mb-1.5">
                    <div className={`flex items-center gap-1.5 ${sportConfig.color}`}>
                        {sportConfig.icon}
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                            {workout.sportType}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Mode */}
                        {workout.mode === 'Outdoor' ? (
                            <Mountain size={12} className="text-slate-500" />
                        ) : (
                            <Home size={12} className="text-slate-500" />
                        )}

                        {/* Status */}
                        {workout.status === 'completed' && (
                            <CheckCircle size={14} className="text-emerald-500" />
                        )}
                        {workout.status === 'missed' && (
                            <XCircle size={14} className="text-red-500" />
                        )}
                    </div>
                </div>

                {/* Title */}
                <h4 className="text-sm font-semibold text-white mb-1 line-clamp-1">
                    {workout.workoutType}
                </h4>

                {/* Metrics */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {duration}
                    </span>
                    {tss > 0 && (
                        <span className="flex items-center gap-1">
                            <Zap size={10} className="text-yellow-500" />
                            {tss}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    // --- JSX Principal ---
    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">

            {/* Synthèse IA */}
            {scheduleData.summary && (
                <div className="bg-linear-to-r from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl p-3 md:p-4 flex items-start gap-3 shadow-lg">
                    <div className="bg-blue-500/20 p-2 rounded-lg shrink-0 hidden sm:block">
                        <Info className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-blue-300 font-bold text-xs md:text-sm uppercase tracking-wide mb-1 flex items-center gap-2">
                            <Info size={16} className="sm:hidden" />
                            Stratégie du Bloc
                        </h3>
                        <p className="text-slate-300 text-xs md:text-sm leading-relaxed italic">
                            &quot;{scheduleData.summary}&quot;
                        </p>
                    </div>
                </div>
            )}

            {/* Header Contrôles */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-[60px] z-30 bg-slate-950/95 py-2 backdrop-blur-md xl:static xl:bg-transparent">
                <div className="flex items-center justify-between w-full xl:w-auto">
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <button
                            onClick={handlePrevMonth}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                            aria-label="Mois précédent"
                        >
                            <ChevronLeft size={20} className="md:w-6 md:h-6" />
                        </button>
                        <h2 className="text-xl md:text-2xl font-bold text-white min-w-[140px] md:min-w-[180px] text-center capitalize">
                            {MONTH_NAMES[month]} {year}
                        </h2>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
                            aria-label="Mois suivant"
                        >
                            <ChevronRight size={20} className="md:w-6 md:h-6" />
                        </button>
                    </div>

                    {/* Boutons Mobile */}
                    <div className="flex xl:hidden gap-2">
                        <button
                            onClick={() => setShowGenModal(true)}
                            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                            title="Nouveau bloc"
                        >
                            <Plus size={20} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Boutons Desktop */}
                <div className="hidden xl:flex gap-2">
                    <Button
                        variant="outline"
                        icon={BrainCircuit}
                        onClick={() => handleGeneratePlan('Objectif Principal', null, null)}
                        disabled={isGenerating}
                        className="text-sm"
                    >
                        Recalculer le Bloc
                    </Button>
                    <Button
                        variant="primary"
                        icon={Plus}
                        onClick={() => setShowGenModal(true)}
                        disabled={isGenerating}
                    >
                        Nouveau Bloc
                    </Button>
                </div>
            </div>

            {/* Indicateur de génération */}
            {isGenerating && (
                <div className="w-full bg-slate-800 rounded-lg p-3 text-center text-blue-400 flex items-center justify-center gap-3 animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Génération en cours...</p>
                </div>
            )}

            {/* Grille Calendrier Desktop */}
            <div className="hidden md:block bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">

                {/* En-têtes des jours */}
                <div className="grid grid-cols-8 border-b border-slate-800">
                    {DAY_NAMES_SHORT.map(day => (
                        <div
                            key={day}
                            className="text-center py-3 text-xs font-bold text-slate-400 uppercase tracking-wider"
                        >
                            {day}
                        </div>
                    ))}
                    <div className="text-center py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Bilan
                    </div>
                </div>

                {/* Semaines */}
                <div>
                    {weekRows.map((week, weekIndex) => {
                        const stats = getWeekStats(week);
                        const progressPercent = stats.plannedDuration > 0
                            ? Math.round((stats.actualDuration / stats.plannedDuration) * 100)
                            : 0;

                        return (
                            <div key={weekIndex} className="grid grid-cols-8 border-b border-slate-800/50 last:border-0">
                                {/* Cellules Jours */}
                                {week.map((date, dayIndex) => {
                                    if (!date) {
                                        return (
                                            <div
                                                key={`empty-${dayIndex}`}
                                                className="bg-slate-950/30 border-r border-slate-800/50 min-h-[140px]"
                                            />
                                        );
                                    }

                                    const workouts = getWorkoutsForDate(date);
                                    const isToday = formatDateKey(date) === formatDateKey(new Date());

                                    return (
                                        <div
                                            key={dayIndex}
                                            className={`
                                                relative group
                                                border-r border-slate-800/50 last:border-0
                                                p-2 min-h-[140px]
                                                flex flex-col
                                                ${isToday ? 'bg-blue-900/10 ring-1 ring-inset ring-blue-500/30' : 'bg-slate-900/40'}
                                                hover:bg-slate-800/60 transition-colors
                                            `}
                                        >
                                            {/* Header : Date + Bouton Add */}
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`
                                                    text-sm font-medium
                                                    ${isToday ? 'text-blue-400 font-bold' : 'text-slate-400'}
                                                `}>
                                                    {date.getDate()}
                                                </span>

                                                <button
                                                    onClick={(e) => handleOpenManualModal(e, date)}
                                                    className={`
                                                        p-1 rounded-full hover:bg-slate-700 text-slate-500 hover:text-blue-400 transition-all
                                                        ${workouts.length === 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                                    `}
                                                    title="Ajouter une séance"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>

                                            {/* Workouts */}
                                            <div className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar">
                                                {workouts.length > 0 ? (
                                                    workouts.map(workout => (
                                                        <div key={workout.id}>
                                                            {renderWorkoutCard(workout, true)}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-xs text-slate-600">
                                                        Repos
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Cellule Bilan Hebdo */}
                                <div className="bg-slate-800/60 p-3 flex flex-col justify-between min-h-[140px]">
                                    {/* Top : Objectifs */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500 flex items-center gap-1">
                                                <Clock size={10} />
                                                Heures
                                            </span>
                                            <span className="font-mono text-white font-semibold">
                                                {formatDuration(stats.plannedDuration)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-500 flex items-center gap-1">
                                                <Zap size={10} className="text-yellow-500" />
                                                TSS
                                            </span>
                                            <span className="font-mono text-white font-semibold">
                                                {stats.plannedTSS}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Middle : Sport Breakdown */}
                                    <div className="flex flex-wrap gap-1 justify-center py-2 border-y border-slate-700/50">
                                        {Object.entries(stats.sportBreakdown).map(([sport, count]) => {
                                            if (count === 0) return null;
                                            const config = SPORT_CONFIG[sport as SportType];
                                            return (
                                                <div
                                                    key={sport}
                                                    className={`flex items-center gap-1 px-2 py-0.5 rounded ${config.bgColor}`}
                                                    title={`${count} séance(s) de ${sport}`}
                                                >
                                                    <span className={config.color}>{config.icon}</span>
                                                    <span className={`text-xs font-bold ${config.color}`}>
                                                        ×{count}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Bottom : Progress Bar */}
                                    {stats.total > 0 && (
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[10px] text-slate-500">
                                                <span>{formatDuration(stats.actualDuration)}</span>
                                                <span>{progressPercent}%</span>
                                            </div>
                                            <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className={`h-1.5 rounded-full transition-all duration-500 ${progressPercent >= 100 ? 'bg-emerald-500' :
                                                        progressPercent >= 80 ? 'bg-green-500' :
                                                            'bg-yellow-500'
                                                        }`}
                                                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Vue Mobile (Liste) */}
            <div className="md:hidden space-y-3">
                {weekRows.flatMap((week, weekIndex) => {
                    const stats = getWeekStats(week);
                    const weekWorkouts = week.flatMap(date =>
                        date ? getWorkoutsForDate(date).map(w => ({ date, workout: w })) : []
                    );

                    return (
                        <div key={weekIndex} className="space-y-2">
                            {/* Header Semaine */}
                            <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-slate-300">
                                        Semaine {weekIndex + 1}
                                    </h3>
                                    <div className="flex gap-2">
                                        {Object.entries(stats.sportBreakdown).map(([sport, count]) => {
                                            if (count === 0) return null;
                                            const config = SPORT_CONFIG[sport as SportType];
                                            return (
                                                <div key={sport} className="flex items-center gap-1">
                                                    <span className={config.color}>{config.icon}</span>
                                                    <span className={`text-xs font-bold ${config.color}`}>×{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {formatDuration(stats.plannedDuration)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Zap size={12} className="text-yellow-500" />
                                        {stats.plannedTSS} TSS
                                    </span>
                                    <span className="text-emerald-400 font-semibold">
                                        {stats.completed}/{stats.total}
                                    </span>
                                </div>
                            </div>

                            {/* Workouts de la semaine */}
                            {weekWorkouts.map(({ date, workout }) => {
                                const isToday = formatDateKey(date) === formatDateKey(new Date());
                                return (
                                    <div
                                        key={`${date.toISOString()}-${workout.id}`}
                                        className={`
                                            rounded-lg border
                                            ${isToday ? 'border-blue-500/50 bg-blue-900/10' : 'border-slate-800 bg-slate-900'}
                                        `}
                                    >
                                        {/* Date Header */}
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
                                            <span className={`text-sm font-medium ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                                                {DAY_NAMES_SHORT[date.getDay()]} {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                                            </span>
                                            <button
                                                onClick={(e) => handleOpenManualModal(e, date)}
                                                className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                                            >
                                                <Plus size={16} className="text-slate-500" />
                                            </button>
                                        </div>

                                        {/* Workout Card */}
                                        <div className="p-3">
                                            {renderWorkoutCard(workout, false)}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Si aucun workout cette semaine */}
                            {weekWorkouts.length === 0 && (
                                <div className="text-center py-6 text-slate-600 text-sm">
                                    Aucune séance programmée
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modals */}
            {showGenModal && (
                <GenerationModal
                    isOpen={showGenModal}
                    onClose={() => setShowGenModal(false)}
                    onGenerate={handleGeneratePlan}
                    isGenerating={isGenerating}
                />
            )}

            {showManualModal && dateForManual && (
                <ManualWorkoutModal
                    date={dateForManual}
                    onClose={() => setShowManualModal(false)}
                    onSave={handleSaveManual}
                />
            )}
        </div>
    );
}
