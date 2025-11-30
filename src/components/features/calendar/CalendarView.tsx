'use client';

import React, { useState, useMemo } from 'react';
import {
    Clock, Zap, Home, Mountain,
    ChevronLeft, ChevronRight, CheckCircle, XCircle,
    BrainCircuit, Plus, Info,
    TrendingUp, MapPin
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
        return mode === 'Indoor' ? <Home size={12} className="text-sky-400" /> : <Mountain size={12} className="text-green-400" />;
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Synthèse IA */}
            {scheduleData.summary && (
                <div className="bg-linear-to-r from-blue-900/40 to-slate-900 border border-blue-500/30 rounded-xl p-4 flex items-start gap-4 shadow-lg">
                    <div className="bg-blue-500/20 p-2 rounded-lg shrink-0">
                        <Info className="text-blue-400" size={24} />
                    </div>
                    <div>
                        <h3 className="text-blue-300 font-bold text-sm uppercase tracking-wide mb-1">Stratégie du Bloc Actuel</h3>
                        <p className="text-slate-300 text-sm leading-relaxed italic">
                            &apos;{scheduleData.summary}&apos;
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                    <button onClick={() => setSelectedDate(new Date(year, month - 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="text-2xl font-bold text-white min-w-[180px] text-center">
                        {monthNames[month]} {year}
                    </h2>
                    <button onClick={() => setSelectedDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
                        <ChevronRight size={24} />
                    </button>
                </div>

                <div className="flex gap-2">
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
                <div className="w-full bg-slate-800 rounded-lg p-3 text-center text-blue-400 flex items-center justify-center gap-3">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p>Génération en cours...</p>
                </div>
            )}

            {/* Grille Calendrier */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="grid grid-cols-8 bg-slate-800/50 border-b border-slate-700">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim', 'Bilan'].map(d => (
                        <div key={d} className={`py-3 text-center text-sm font-semibold ${d === 'Bilan' ? 'text-blue-400 bg-slate-800/80' : 'text-slate-400'}`}>
                            {d}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-8 auto-rows-fr">
                    {weeks.map((week, wIdx) => {
                        const stats = getWeekStats(week);

                        return (
                            <React.Fragment key={wIdx}>
                                {week.map((date, dIdx) => {
                                    const workout = getWorkoutForDate(date);
                                    const isToday = date && formatDateKey(date) === formatDateKey(new Date());

                                    return (
                                        <div
                                            key={dIdx}
                                            onClick={() => date && workout ? onViewWorkout(workout) : null}
                                            className={`
                                                min-h-[100px] md:min-h-[140px] border-b border-r border-slate-800 p-2 relative transition-colors group
                                                ${!date ? 'bg-slate-950' : workout ? 'bg-slate-900 hover:bg-slate-800 cursor-pointer' : 'bg-slate-900/50 hover:bg-slate-800/80'}
                                                ${isToday ? 'ring-1 ring-inset ring-blue-500/50 bg-blue-900/5' : ''}
                                            `}
                                        >
                                            {date && (
                                                <>
                                                    <div className="flex justify-between items-start">
                                                        <span className={`text-sm font-medium ${isToday ? 'text-blue-400' : 'text-slate-500'}`}>
                                                            {date.getDate()}
                                                        </span>

                                                        {/* BOUTON AJOUT MANUEL */}
                                                        {/* {!workout && ( */}
                                                        <button
                                                            onClick={(e) => handleOpenManualModal(e, date)}
                                                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-blue-400 transition-opacity p-1"
                                                            title="Ajouter une séance"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                        {/* )} */}
                                                    </div>

                                                    {workout && (
                                                        <div className="mt-2 flex flex-col gap-1.5 animate-in fade-in zoom-in duration-300">
                                                            <div className="flex justify-between items-center">
                                                                <span className={`text-[10px] px-1.5 rounded-sm font-bold uppercase truncate
                                                                    ${workout.type === 'Rest' ? 'text-slate-500' :
                                                                        workout.type === 'HIIT' || workout.type === 'PMA' ? 'text-orange-400 bg-orange-950/30' :
                                                                            workout.type === 'VO2max' ? 'text-purple-400 bg-purple-950/30' :
                                                                                workout.type === 'Test' ? 'text-cyan-400 bg-cyan-950/30' :
                                                                                    'text-blue-300 bg-blue-950/30'}
                                                                `}>
                                                                    {workout.type}
                                                                </span>
                                                                {workout.mode && <div className='p-0.5 rounded-full bg-slate-700'>{getModeIcon(workout.mode)}</div>}
                                                            </div>
                                                            <span className="text-xs text-slate-200 leading-tight line-clamp-2">{workout.title}</span>
                                                            {workout.duration && <span className="text-[10px] text-slate-500">{workout.duration} min</span>}

                                                            {workout.status === 'completed' && <CheckCircle size={14} className="absolute top-2 right-2 text-emerald-500" />}
                                                            {workout.status === 'missed' && <XCircle size={14} className="absolute top-2 right-2 text-red-500" />}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Cellule Bilan de la Semaine */}
                                <div className="min-h-[100px] md:min-h-[140px] border-b border-slate-700 bg-slate-800/40 p-2 flex flex-col justify-center gap-2">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="flex items-center"><Zap size={12} className="mr-1 text-yellow-500" /> TSS</span>
                                        <span className="font-mono text-white">{stats.plannedTSS}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="flex items-center"><Clock size={12} className="mr-1 text-blue-500" /> Durée</span>
                                        <span className="font-mono text-white">{Math.floor(stats.plannedDuration / 60)}h{stats.plannedDuration % 60 > 0 ? stats.plannedDuration % 60 : ''}</span>
                                    </div>
                                    {(stats.actualDuration > 0 || stats.distance > 0) && (
                                        <div className="mt-1 pt-1 border-t border-slate-700">
                                            <div className="flex items-center justify-between text-xs text-emerald-400">
                                                <span className="flex items-center"><TrendingUp size={12} className="mr-1" /> Réel</span>
                                                <span className="font-mono">{Math.floor(stats.actualDuration / 60)}h</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-emerald-400">
                                                <span className="flex items-center"><MapPin size={12} className="mr-1" /> Dist.</span>
                                                <span className="font-mono">{stats.distance.toFixed(0)}km</span>
                                            </div>
                                        </div>
                                    )}
                                    {stats.total > 0 && (
                                        <div className="mt-1 w-full bg-slate-700 rounded-full h-1.5">
                                            <div
                                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                                            ></div>
                                        </div>
                                    )}
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