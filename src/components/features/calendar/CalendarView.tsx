'use client';

import React, { useState, useMemo } from 'react';
import {
    Clock, Zap, Home, Mountain,
    ChevronLeft, ChevronRight, CheckCircle, XCircle,
    BrainCircuit, Plus, Info
} from 'lucide-react';
import { Workout } from '@/lib/data/type';
import { Button } from '@/components/ui/Button';
import { ManualWorkoutModal } from '../workout/ManualWorkoutModal';
import { GenerationModal } from './GenerationModal';

interface CalendarViewProps {
    scheduleData: { workouts: { [key: string]: Workout }, summary: string | null };
    onViewWorkout: (workout: Workout) => void;
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) => Promise<void>;
    onAddManualWorkout: (workout: Workout) => Promise<void>;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ scheduleData, onViewWorkout, onGenerate, onAddManualWorkout }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showGenModal, setShowGenModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [dateForManual, setDateForManual] = useState<Date | null>(null);

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    const formatDateKey = (date: Date) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getWorkoutForDate = (dateObj: Date | null) => {
        if (!dateObj) return null;
        const dKey = formatDateKey(dateObj);
        return scheduleData.workouts?.[dKey];
    };

    const getModeIcon = (mode: string) => {
        return mode === 'Indoor' ? <Home size={14} className="text-sky-400" /> : <Mountain size={14} className="text-green-400" />;
    };

    const weeks = useMemo(() => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

        const weekRows: (Date | null)[][] = [];
        let currentWeek: (Date | null)[] = Array(startOffset).fill(null);

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

    const getWeekStats = (weekDays: (Date | null)[]) => {
        let plannedTSS = 0;
        let actualDuration = 0;
        let plannedDuration = 0;
        let distance = 0;
        let completed = 0;
        let total = 0;

        weekDays.forEach(date => {
            const workout = getWorkoutForDate(date);
            if (workout) {
                total++;
                plannedTSS += workout.tss || 0;
                plannedDuration += workout.duration || 0;
                if (workout.status === 'completed') {
                    completed++;
                    actualDuration += workout.completedData?.actualDuration
                        ? Number(workout.completedData.actualDuration)
                        : (workout.duration || 0);
                    distance += workout.completedData?.distance
                        ? Number(workout.completedData.distance)
                        : 0;
                }
            }
        });
        return { plannedTSS, plannedDuration, actualDuration, distance, completed, total };
    };

    const handleGeneratePlan = async (blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) => {
        setIsGenerating(true);
        try {
            await onGenerate(blockFocus, customTheme, startDate, numWeeks);
        } catch (e) {
            console.error("Erreur de génération du plan:", e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleOpenManualModal = (e: React.MouseEvent, date: Date) => {
        e.stopPropagation();
        setDateForManual(date);
        setShowManualModal(true);
    };

    const handleSaveManual = async (workout: Workout) => {
        await onAddManualWorkout(workout);
    };

    const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    const dayNamesShort = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">

            {/* --- Synthèse IA --- */}
            {scheduleData.summary && (
                <div className="bg-linear-to-r from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl p-3 md:p-4 flex flex-col sm:flex-row items-start gap-3 md:gap-4 shadow-lg">
                    <div className="bg-blue-500/20 p-2 rounded-lg shrink-0 hidden sm:block">
                        <Info className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-blue-300 font-bold text-xs md:text-sm uppercase tracking-wide mb-1 flex items-center gap-2">
                            <span className="sm:hidden"><Info size={16} /></span>
                            Stratégie du Bloc
                        </h3>
                        <p className="text-slate-300 text-xs md:text-sm leading-relaxed italic">
                            &apos;{scheduleData.summary}&apos;
                        </p>
                    </div>
                </div>
            )}

            {/* --- Header Contrôles --- */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-[60px] z-30 bg-slate-950/95 py-2 backdrop-blur-md xl:static xl:bg-transparent">
                <div className="flex items-center justify-between w-full xl:w-auto">
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <button onClick={() => setSelectedDate(new Date(year, month - 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                            <ChevronLeft size={20} className="md:w-6 md:h-6" />
                        </button>
                        <h2 className="text-xl md:text-2xl font-bold text-white min-w-[140px] md:min-w-[180px] text-center capitalize">
                            {monthNames[month]} {year}
                        </h2>
                        <button onClick={() => setSelectedDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                            <ChevronRight size={20} className="md:w-6 md:h-6" />
                        </button>
                    </div>

                    <div className="flex xl:hidden gap-2">
                        <button
                            onClick={() => handleGeneratePlan('Objectif Principal', null, null)}
                            disabled={isGenerating}
                            className="p-2 bg-slate-800 text-slate-300 rounded-lg"
                        >
                            <BrainCircuit size={20} />
                        </button>
                        <button
                            onClick={() => setShowGenModal(true)}
                            disabled={isGenerating}
                            className="p-2 bg-blue-600 text-white rounded-lg"
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

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

            {isGenerating && (
                <div className="w-full bg-slate-800 rounded-lg p-3 text-center text-blue-400 flex items-center justify-center gap-3 animate-pulse">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm">Génération en cours...</p>
                </div>
            )}

            {/* --- Grille Calendrier --- */}
            <div className="bg-transparent md:bg-slate-900 md:rounded-xl md:border md:border-slate-800 overflow-hidden md:shadow-2xl">

                <div className="hidden md:grid grid-cols-8 bg-slate-800/50 border-b border-slate-700">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Bilan'].map(d => (
                        <div key={d} className={`py-3 text-center text-sm font-semibold ${d === 'Bilan' ? 'text-blue-400 bg-slate-800/80' : 'text-slate-400'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-8 auto-rows-fr gap-3 md:gap-0">
                    {weeks.map((week, wIdx) => {
                        const stats = getWeekStats(week);

                        return (
                            <React.Fragment key={wIdx}>
                                {week.map((date, dIdx) => {
                                    if (!date) {
                                        return <div key={`empty-${dIdx}`} className="hidden md:block bg-slate-950/30 border-b border-r border-slate-800/50 min-h-[140px]" />;
                                    }

                                    const workout = getWorkoutForDate(date);
                                    const isToday = formatDateKey(date) === formatDateKey(new Date());

                                    return (
                                        <div
                                            key={dIdx}
                                            onClick={() => workout ? onViewWorkout(workout) : null}
                                            className={`
                                                relative transition-all duration-200 group
                                                rounded-xl md:rounded-none border border-slate-800 md:border-0 md:border-b md:border-r 
                                                p-3 md:p-2 min-h-20 md:min-h-[140px]
                                                flex flex-col justify-between
                                                ${workout ? 'bg-slate-900 hover:border-slate-600 cursor-pointer active:scale-[0.98]' : 'bg-slate-900/40'}
                                                md:hover:bg-slate-800/80
                                                ${isToday ? 'ring-1 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] bg-blue-900/10' : ''}
                                            `}
                                        >
                                            {/* En-tête de la cellule */}
                                            <div className="flex justify-between items-start mb-2 md:mb-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm font-medium ${isToday ? 'text-blue-400 font-bold' : 'text-slate-500'}`}>
                                                        <span className="md:hidden inline-block w-8">{dayNamesShort[date.getDay()]}</span>
                                                        {date.getDate()}
                                                    </span>
                                                    {isToday && <span className="md:hidden text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">Auj.</span>}
                                                </div>

                                                <button
                                                    onClick={(e) => handleOpenManualModal(e, date)}
                                                    className={`
                                                        p-1.5 rounded-full hover:bg-slate-700 text-slate-500 hover:text-blue-400 transition-all
                                                        ${!workout ? 'opacity-100 md:opacity-0 md:group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}
                                                    `}
                                                    title="Ajouter une séance"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>

                                            {workout ? (
                                                <div className="flex flex-row md:flex-col gap-3 md:gap-1.5 items-center md:items-stretch h-full">

                                                    {/* --- FIX ICONS OVERLAP (Desktop) --- */}
                                                    {/* Statut (Check/Missed) -> HAUT DROITE */}
                                                    <div className="shrink-0">
                                                        {workout.status === 'completed' && <CheckCircle size={18} className="text-emerald-500 md:absolute md:top-1.5 md:right-1.5" />}
                                                        {workout.status === 'missed' && <XCircle size={18} className="text-red-500 md:absolute md:top-1.5 md:right-1.5" />}
                                                    </div>

                                                    {/* Mode (Indoor/Outdoor) -> BAS DROITE sur Desktop */}
                                                    {workout.mode && (
                                                        <div className="hidden md:block absolute bottom-2 right-2 opacity-60">
                                                            {getModeIcon(workout.mode)}
                                                        </div>
                                                    )}

                                                    {/* Info Principales */}
                                                    <div className="shrink-0 md:w-full flex justify-between items-center">
                                                        <span className={`hidden md:block text-[10px] px-1.5 rounded-sm font-bold uppercase truncate w-full text-center
                                                            ${workout.type === 'Rest' ? 'text-slate-500' :
                                                                workout.type === 'HIIT' || workout.type === 'PMA' ? 'text-orange-400 bg-orange-950/30' :
                                                                    workout.type === 'VO2max' ? 'text-purple-400 bg-purple-950/30' :
                                                                        workout.type === 'Test' ? 'text-cyan-400 bg-cyan-950/30' :
                                                                            'text-blue-300 bg-blue-950/30'}
                                                        `}>
                                                            {workout.type}
                                                        </span>

                                                        <div className={`md:hidden w-1 h-10 rounded-full
                                                            ${workout.type === 'Rest' ? 'bg-slate-700' :
                                                                workout.type === 'HIIT' ? 'bg-orange-500' :
                                                                    'bg-blue-500'}
                                                        `}></div>
                                                    </div>

                                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                        <div className="flex items-center gap-2 mb-0.5 md:mb-0">
                                                            <span className="text-sm md:text-xs font-semibold md:font-normal text-slate-100 md:text-slate-200 line-clamp-1 md:line-clamp-2">
                                                                {workout.title}
                                                            </span>
                                                            <div className="md:hidden opacity-70">
                                                                {getModeIcon(workout.mode)}
                                                            </div>
                                                        </div>

                                                        {workout.duration && (
                                                            <div className="flex items-center text-xs text-slate-500">
                                                                <Clock size={10} className="mr-1" />
                                                                {workout.duration} min
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="md:hidden flex items-center justify-center h-full opacity-30 text-xs">
                                                    Repos
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* --- Cellule Bilan de la Semaine --- */}
                                <div className="
                                    rounded-xl md:rounded-none border border-slate-700 md:border-b md:border-r md:border-0 
                                    bg-slate-800/40 md:bg-slate-800/40 
                                    p-3 md:p-2 
                                    flex flex-row md:flex-col justify-between items-center md:justify-center gap-2 md:gap-2
                                    mt-1 md:mt-0 mb-4 md:mb-0
                                ">
                                    <div className="md:hidden text-xs font-bold text-slate-500 uppercase tracking-widest writing-mode-vertical rotate-180">
                                        Bilan S{wIdx + 1}
                                    </div>

                                    <div className="flex-1 grid grid-cols-3 md:grid-cols-1 gap-2 w-full">
                                        <div className="flex flex-col md:flex-row items-center md:justify-between text-xs text-slate-400">
                                            <span className="flex items-center gap-1 mb-1 md:mb-0"><Zap size={12} className="text-yellow-500" /> <span className="hidden md:inline">TSS</span></span>
                                            <span className="font-mono text-white text-sm md:text-xs">{stats.plannedTSS}</span>
                                        </div>

                                        <div className="flex flex-col md:flex-row items-center md:justify-between text-xs text-slate-400">
                                            <span className="flex items-center gap-1 mb-1 md:mb-0"><Clock size={12} className="text-blue-500" /> <span className="hidden md:inline">Heures</span></span>
                                            <span className="font-mono text-white text-sm md:text-xs">
                                                {Math.floor(stats.plannedDuration / 60)}h{stats.plannedDuration % 60 > 0 ? stats.plannedDuration % 60 : ''}
                                            </span>
                                        </div>

                                        {/* --- BARRE DE PROGRESSION VERTE --- */}
                                        {stats.total > 0 && (
                                            <div className="col-span-3 md:col-span-1 mt-1 md:pt-1 md:border-t md:border-slate-700">
                                                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                                    <span>{stats.completed}/{stats.total}</span>
                                                    <span>{Math.round((stats.completed / stats.total) * 100)}%</span>
                                                </div>
                                                <div className="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                                        style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

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
};