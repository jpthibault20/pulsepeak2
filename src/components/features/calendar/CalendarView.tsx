'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, BrainCircuit, Info, X, Target, Home } from 'lucide-react';
import type { Workout } from '@/lib/data/type';
import { Button } from '@/components/ui/Button';
import { ManualWorkoutModal } from '../workout/ManualWorkoutModal';
import { GenerationModal } from './GenerationModal';
import { CalendarGrid } from '@/components/features/calendar/CalendarGrid';
import { MobileCalendarList } from '@/components/features/calendar/MobileCalendarList';
import { useCalendarDays } from '@/hooks/useCalendarDays';
import { MONTH_NAMES } from '@/lib/utils';
import { Schedule } from '@/lib/data/DatabaseTypes';

interface CalendarViewProps {
    scheduleData: Schedule;
    onViewWorkout: (workout: Workout) => void;
    onGenerate: (blockFocus: string, customTheme: string | null, startDate: string | null, numWeeks?: number) => void;
    onAddManualWorkout: (workout: Workout) => void;
    onSyncStrava?: () => void;
    isSyncing?: boolean;
}

export function CalendarView({
    scheduleData,
    onViewWorkout,
    onGenerate,
    onAddManualWorkout,
    onSyncStrava,
    isSyncing = false
}: CalendarViewProps) {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showGenModal, setShowGenModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false); // État pour la popup de résumé
    const [dateForManual, setDateForManual] = useState<Date | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const { year, month, weekRows } = useCalendarDays(selectedDate);

    // --- Handlers ---
    const handleGeneratePlan = async (
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
    };

    const handleOpenManualModal = (e: React.MouseEvent, date: Date) => {
        e.stopPropagation();
        setDateForManual(date);
        setShowManualModal(true);
    };

    const handleSaveManual = async (workout: Workout) => {
        await onAddManualWorkout(workout);
        setShowManualModal(false);
    };

    const handlePrevMonth = () => setSelectedDate(new Date(year, month - 1));
    const handleActualMonth = () => setSelectedDate(new Date(new Date().getFullYear(), new Date().getMonth()));
    const handleNextMonth = () => setSelectedDate(new Date(year, month + 1));

    return (
        <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-20 md:pb-0">

            {/* Header Controls & Title */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-[60px] z-30 bg-slate-950/95 py-2 backdrop-blur-md xl:static xl:bg-transparent border-b xl:border-none border-slate-800/50">
                <div className="flex items-center justify-between w-full xl:w-auto">
                    <div className="flex items-center space-x-2 md:space-x-4">
                        {/* Navigation Mois */}
                        <div className="flex items-center bg-slate-900/50 rounded-full p-1 border border-slate-800">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1.5 hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <h2 className="text-lg md:text-xl font-bold text-white min-w-[120px] text-center capitalize px-2">
                                {MONTH_NAMES[month]} {year}
                            </h2>
                            <button
                                onClick={handleNextMonth}
                                className="p-1.5 hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
                            >
                                <ChevronRight size={18} />
                            </button>
                            <div className="h-6 w-px bg-slate-800 mx-1" />
                            <button
                                onClick={handleActualMonth}
                                className="p-1.5 hover:bg-slate-700 rounded-full text-slate-400 transition-colors"
                            >
                                <Home size={18} />
                            </button>
                        </div>

                        {/* Bouton Info Stratégie (Mobile) - Si un résumé existe */}
                        {onSyncStrava && (
                            <button
                                onClick={onSyncStrava}
                                disabled={isSyncing}
                                className={`
                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/60
                ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
                                title="Synchroniser avec Strava"
                            >
                                {/* Icône de Sync / Refresh */}
                                <svg
                                    className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>

                                <span className="hidden sm:inline">
                                    {isSyncing ? 'Synchro...' : 'Strava'}
                                </span>
                            </button>
                        )}
                    </div>

                    {scheduleData.summary && (
                        <button
                            onClick={() => setShowSummaryModal(true)}
                            className="xl:hidden ml-2 p-2 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20 hover:bg-blue-500/20 transition-colors animate-pulse"
                            title="Voir la stratégie"
                        >
                            <Info size={20} />
                        </button>
                    )}

                    {/* Mobile Action Buttons (Plus) */}
                    <div className="flex xl:hidden gap-2 ml-auto pl-2">
                        <button
                            onClick={() => setShowGenModal(true)}
                            className="p-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                        >
                            <Plus size={20} className="text-white" />
                        </button>
                    </div>
                </div>

                {/* Desktop Buttons & Info */}
                <div className="hidden xl:flex items-center gap-3">
                    {/* Bouton Stratégie (Desktop) */}
                    {scheduleData.summary && (
                        <button
                            onClick={() => setShowSummaryModal(true)}
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-300 hover:text-white bg-blue-950/30 hover:bg-blue-900/50 border border-blue-500/30 rounded-lg transition-all"
                        >
                            <Info size={16} />
                            <span>Stratégie du bloc</span>
                        </button>
                    )}

                    <div className="h-6 w-px bg-slate-800 mx-1" />

                    <Button
                        variant="ghost"
                        icon={BrainCircuit}
                        onClick={() => handleGeneratePlan('Objectif Principal', null, null)}
                        disabled={isGenerating}
                        className="text-sm text-slate-400 hover:text-white"
                    >
                        Recalculer
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

            {/* Loading Indicator */}
            {isGenerating && (
                <div className="w-full bg-slate-800 rounded-lg p-3 text-center text-blue-400 flex items-center justify-center gap-3 animate-pulse border border-slate-700">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-medium">L&apos;IA prépare votre plan...</p>
                </div>
            )}

            {/* Desktop Calendar Grid */}
            <div className="hidden md:block">
                <CalendarGrid
                    weekRows={weekRows}
                    currentMonth={month}
                    currentYear={year}
                    scheduleData={scheduleData}
                    onOpenManualModal={handleOpenManualModal}
                    onViewWorkout={onViewWorkout}
                />
            </div>

            {/* Mobile List */}
            <div className="md:hidden">
                <MobileCalendarList
                    weekRows={weekRows}
                    currentMonth={month}
                    scheduleData={scheduleData}
                    onOpenManualModal={handleOpenManualModal}
                    onViewWorkout={onViewWorkout}
                />
            </div>

            {/* --- MODALS --- */}

            {/* Popup Résumé Stratégie (Nouveau) */}
            {showSummaryModal && scheduleData.summary && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Popup */}
                        <div className="bg-linear-to-r from-blue-900/20 to-slate-900 p-4 border-b border-slate-800 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-500/20 p-2 rounded-lg">
                                    <Target className="text-blue-400" size={20} />
                                </div>
                                <h3 className="text-white font-bold text-lg">Stratégie du Bloc</h3>
                            </div>
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full p-2 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content Popup */}
                        <div className="p-6">
                            <p className="text-slate-300 text-base leading-relaxed italic border-l-4 border-blue-500/50 pl-4 py-1">
                                &quot;{scheduleData.summary}&quot;
                            </p>
                        </div>

                        {/* Footer Popup */}
                        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-end">
                            <Button variant="outline" onClick={() => setShowSummaryModal(false)} className="text-sm">
                                Fermer
                            </Button>
                        </div>
                    </div>
                    {/* Click outside to close */}
                    <div className="absolute inset-0 -z-10" onClick={() => setShowSummaryModal(false)} />
                </div>
            )}

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
