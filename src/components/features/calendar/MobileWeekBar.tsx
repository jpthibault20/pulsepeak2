'use client';

import React, { useState, useCallback } from 'react';
import { Sparkles, Sparkle, Zap, ChevronDown, ChevronUp, Bike, Waves, Footprints, Bot, Loader2, AlertCircle, Plus, Target, Calendar, X, MessageSquare } from 'lucide-react';
import { WeekGenerationProgressModal, type WeekGenProgressState } from './WeekGenerationProgressModal';
import type { WeekStats } from '@/hooks/useWeekStats';
import type { AvailabilitySlot } from '@/lib/data/type';
import { getWeekContextForDate, generateWeekWorkoutsFromDate, getWeekPendingCount, type WeekContext } from '@/app/actions/schedule';
import { FeatureGate } from '@/components/features/billing/FeatureGate';
import { DurationInput } from '@/components/features/profile/Availability';

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

const WEEK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    Load:     { label: 'Charge',       color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20' },
    Recovery: { label: 'Récupération', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
    Taper:    { label: 'Affûtage',     color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' },
};

interface MobileWeekBarProps {
    stats: WeekStats;
    weekStartDate: string | null;
    isPastWeek: boolean;
    isFarFuture: boolean;
    weeksAhead: number;
    profileAvailability: { [key: string]: AvailabilitySlot };
    activeSports: { swimming: boolean; cycling: boolean; running: boolean };
    onRefresh: () => void;
    onOpenGenModal: () => void;
}

export function MobileWeekBar({
    stats,
    weekStartDate,
    isPastWeek,
    isFarFuture,
    weeksAhead,
    profileAvailability,
    activeSports,
    onRefresh,
    onOpenGenModal,
}: MobileWeekBarProps) {
    const [expanded, setExpanded] = useState(false);
    const [showGenSheet, setShowGenSheet] = useState(false);

    // Generation state
    const [comment, setComment] = useState('');
    const [availability, setAvailability] = useState<{ [key: string]: AvailabilitySlot }>({});
    const [weekContext, setWeekContext] = useState<WeekContext>(null);
    const [pendingCount, setPendingCount] = useState(0);
    const [confirmOverwrite, setConfirmOverwrite] = useState(false);
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [weekGenProgress, setWeekGenProgress] = useState<WeekGenProgressState>({
        active: false, minimized: false, done: false, error: null, startedAt: 0, weekLabel: '',
    });

    const formatDuration = (totalMinutes: number) => {
        if (!totalMinutes) return '0h00';
        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        return `${h}h${m.toString().padStart(2, '0')}`;
    };

    const durationPercentage = stats.plannedDuration === 0
        ? (stats.actualDuration > 0 ? 100 : 0)
        : Math.min((stats.actualDuration / stats.plannedDuration) * 100, 100);

    const handleOpenGenSheet = useCallback(() => {
        if (!weekStartDate) return;

        const defaultAvail: { [key: string]: AvailabilitySlot } = {};
        DAYS_FR.forEach(day => {
            defaultAvail[day] = profileAvailability[day]
                ?? { swimming: 0, cycling: 0, running: 0, comment: '', aiChoice: false };
        });
        setAvailability(defaultAvail);
        setComment('');
        setError(null);
        setWeekContext(null);
        setPendingCount(0);
        setConfirmOverwrite(false);
        setShowGenSheet(true);

        setIsLoadingContext(true);
        Promise.all([
            getWeekContextForDate(weekStartDate),
            getWeekPendingCount(weekStartDate),
        ])
            .then(([ctx, count]) => { setWeekContext(ctx); setPendingCount(count); })
            .catch(() => { setWeekContext(null); setPendingCount(0); })
            .finally(() => setIsLoadingContext(false));
    }, [weekStartDate, profileAvailability]);

    const handleGenerate = async () => {
        if (!weekStartDate) return;

        if (pendingCount > 0 && !confirmOverwrite) {
            setConfirmOverwrite(true);
            return;
        }

        const weekLabel = `Semaine du ${new Date(weekStartDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;

        setIsGenerating(true);
        setError(null);
        setShowGenSheet(false);
        setWeekGenProgress({
            active: true, minimized: false, done: false, error: null,
            startedAt: Date.now(), weekLabel,
        });

        try {
            await generateWeekWorkoutsFromDate(weekStartDate, comment || null, availability);
            setWeekGenProgress(prev => ({ ...prev, done: true }));
            onRefresh();
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erreur lors de la génération.';
            setWeekGenProgress(prev => ({ ...prev, done: true, error: msg }));
        } finally {
            setIsGenerating(false);
            setConfirmOverwrite(false);
        }
    };

    const updateSlot = (
        day: string,
        sport: keyof Omit<AvailabilitySlot, 'comment'>,
        value: number
    ) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], [sport]: Math.max(0, value) },
        }));
    };

    const updateDayComment = (day: string, value: string) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], comment: value },
        }));
    };

    const updateAiChoice = (day: string, value: boolean) => {
        setAvailability(prev => ({
            ...prev,
            [day]: { ...prev[day], aiChoice: value },
        }));
    };

    // ISO week number
    const weekNum = (() => {
        if (!weekStartDate) return '';
        const d = new Date(weekStartDate + 'T00:00:00');
        const dayNum = d.getDay() || 7;
        d.setDate(d.getDate() + 4 - dayNum);
        const yearStart = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    })();

    // ── STATE A: Empty week ──
    if (stats.total === 0) {
        return (
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600" />
                    <span className="text-xs text-slate-500 font-medium">Aucune séance cette semaine</span>
                </div>

                {isPastWeek ? (
                    <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-600 font-medium">
                        Semaine passée
                    </div>
                ) : (
                    <>
                        <FeatureGate feature="generate-plan" mode="modal" label="Générer un plan IA">
                            <button
                                onClick={handleOpenGenSheet}
                                className="w-full flex items-center justify-center gap-2 py-2.5 mt-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 rounded-xl text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-500/20"
                                aria-label="Générer les séances de la semaine avec l'IA"
                            >
                                <Sparkles size={14} />
                                Générer cette semaine
                            </button>
                        </FeatureGate>
                        {renderGenSheet()}
                    </>
                )}
                <WeekGenerationProgressModal
                    state={weekGenProgress}
                    onMinimize={() => setWeekGenProgress(prev => ({ ...prev, minimized: true }))}
                    onRestore={() => setWeekGenProgress(prev => ({ ...prev, minimized: false }))}
                    onClose={() => setWeekGenProgress(prev => ({ ...prev, active: false }))}
                />
            </div>
        );
    }

    // ── STATE B/C: Week with workouts ──
    return (
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3">
            {/* Header */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="flex items-center justify-between w-full"
                aria-expanded={expanded}
                aria-label="Voir le détail de la semaine"
            >
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    S{weekNum} · {stats.total} séance{stats.total > 1 ? 's' : ''} · {formatDuration(stats.plannedDuration)}
                </span>
                {expanded
                    ? <ChevronUp size={14} className="text-slate-400 dark:text-slate-500" />
                    : <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
                }
            </button>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                        durationPercentage >= 100
                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                            : 'bg-gradient-to-r from-blue-600 to-blue-400'
                    }`}
                    style={{ width: `${durationPercentage}%` }}
                />
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {formatDuration(stats.actualDuration)} réalisé · {stats.completed}/{stats.total}
                </span>
                <span className="text-[10px] font-medium flex items-center gap-1">
                    <Zap size={9} className="text-yellow-500/70" />
                    <span className={stats.completedTSS > 0 ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}>{Math.round(stats.completedTSS)}</span>
                    <span className="text-slate-300 dark:text-slate-600">/</span>
                    <span className="text-slate-500 dark:text-slate-400">{Math.round(stats.plannedTSS)}</span>
                    <span className="text-slate-400 dark:text-slate-500">TSS</span>
                </span>
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700/50 animate-in fade-in slide-in-from-top-1 duration-200">
                    {/* Sport breakdown badges */}
                    <div className="flex flex-wrap gap-1.5">
                        {stats.sportDuration.cycling > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20">
                                <Bike size={10} />
                                {formatDuration(stats.sportDuration.cycling)}
                            </span>
                        )}
                        {stats.sportDuration.running > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20">
                                <Footprints size={10} />
                                {formatDuration(stats.sportDuration.running)}
                            </span>
                        )}
                        {stats.sportDuration.swimming > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20">
                                <Waves size={10} />
                                {formatDuration(stats.sportDuration.swimming)}
                            </span>
                        )}
                    </div>

                </div>
            )}

            {renderGenSheet()}
            <WeekGenerationProgressModal
                state={weekGenProgress}
                onMinimize={() => setWeekGenProgress(prev => ({ ...prev, minimized: true }))}
                onRestore={() => setWeekGenProgress(prev => ({ ...prev, minimized: false }))}
                onClose={() => setWeekGenProgress(prev => ({ ...prev, active: false }))}
            />
        </div>
    );

    // ── Generation Bottom Sheet ──
    function renderGenSheet() {
        if (!showGenSheet) return null;
        return (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !isGenerating && setShowGenSheet(false)}>
                <div
                    className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 rounded-t-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Handle */}
                    <div className="flex justify-center pt-3">
                        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 dark:bg-blue-500/20 p-2 rounded-lg">
                                <Bot size={18} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-slate-900 dark:text-white font-bold text-base">Générer la semaine</h3>
                                {weekStartDate && (
                                    <p className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                        <Calendar size={10} />
                                        Semaine du{' '}
                                        {new Date(weekStartDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setShowGenSheet(false)}
                            disabled={isGenerating}
                            className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-4 py-3 space-y-4">

                        {/* Context */}
                        {isLoadingContext ? (
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-1">
                                <Loader2 size={14} className="animate-spin" />
                                Chargement du contexte...
                            </div>
                        ) : weekContext ? (
                            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Target size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Contexte du plan
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${WEEK_TYPE_LABELS[weekContext.weekType]?.color ?? 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}>
                                        {WEEK_TYPE_LABELS[weekContext.weekType]?.label ?? weekContext.weekType}
                                    </span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        Semaine {weekContext.weekNumber}/{weekContext.blockWeekCount}
                                    </span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20">
                                        {weekContext.targetTSS} TSS cible
                                    </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-snug">
                                    <span className="text-slate-400 dark:text-slate-500 text-[10px] mr-1">Thème :</span>
                                    &ldquo;{weekContext.blockTheme}&rdquo;
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-3 py-2.5">
                                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs font-medium">
                                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                    <span>Aucun bloc ni plan actif pour cette période.</span>
                                </div>
                                <button
                                    onClick={() => { setShowGenSheet(false); onOpenGenModal(); }}
                                    className="self-start flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Plus size={12} />
                                    Calculer un nouveau plan
                                </button>
                            </div>
                        )}

                        {/* Far future warning */}
                        {isFarFuture && (
                            <div className="flex items-start gap-2 text-yellow-600 dark:text-yellow-400 text-xs bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                <span>
                                    Génération <strong>+{weeksAhead} semaines</strong> en avance — précision moindre.
                                </span>
                            </div>
                        )}

                        {/* Comment */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Commentaire
                            </label>
                            <textarea
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Ex : semaine chargée, jambes lourdes..."
                                rows={2}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none focus:outline-none focus:border-blue-400/60 dark:focus:border-blue-500/60 focus:ring-1 focus:ring-blue-400/30 dark:focus:ring-blue-500/30 transition-colors"
                            />
                        </div>

                        {/* Availability */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                Disponibilités
                            </label>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-200 dark:border-slate-800">
                                            <th className="text-left py-1.5 font-medium text-slate-400 dark:text-slate-500 w-16 pl-1 text-xs">Jour</th>
                                            <th className="py-1.5 w-10 text-center">
                                                <div className="flex justify-center">
                                                    <div className="p-1 bg-violet-50 dark:bg-violet-500/10 rounded text-violet-600 dark:text-violet-400">
                                                        <Sparkle size={14} />
                                                    </div>
                                                </div>
                                            </th>
                                            {activeSports.swimming && (
                                                <th className="py-1.5 w-16 text-center">
                                                    <div className="flex justify-center">
                                                        <div className="p-1 bg-cyan-50 dark:bg-cyan-500/10 rounded text-cyan-600 dark:text-cyan-400">
                                                            <Waves size={14} />
                                                        </div>
                                                    </div>
                                                </th>
                                            )}
                                            {activeSports.cycling && (
                                                <th className="py-1.5 w-16 text-center">
                                                    <div className="flex justify-center">
                                                        <div className="p-1 bg-orange-50 dark:bg-orange-500/10 rounded text-orange-600 dark:text-orange-400">
                                                            <Bike size={14} />
                                                        </div>
                                                    </div>
                                                </th>
                                            )}
                                            {activeSports.running && (
                                                <th className="py-1.5 w-16 text-center">
                                                    <div className="flex justify-center">
                                                        <div className="p-1 bg-emerald-50 dark:bg-emerald-500/10 rounded text-emerald-600 dark:text-emerald-400">
                                                            <Footprints size={14} />
                                                        </div>
                                                    </div>
                                                </th>
                                            )}
                                            <th className="py-1.5 text-center">
                                                <div className="flex justify-center">
                                                    <div className="p-1 bg-slate-50 dark:bg-slate-500/10 rounded text-slate-500 dark:text-slate-400">
                                                        <MessageSquare size={14} />
                                                    </div>
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {DAYS_FR.map(day => {
                                            const slot = availability[day] ?? { swimming: 0, cycling: 0, running: 0, comment: '', aiChoice: false };
                                            const isAiChoice = slot.aiChoice ?? false;
                                            return (
                                                <tr key={day} className={isAiChoice ? 'bg-violet-50/50 dark:bg-violet-500/5' : ''}>
                                                    <td className="py-1 pl-1 text-slate-500 dark:text-slate-400 font-medium capitalize text-[11px]">
                                                        {day.slice(0, 3)}
                                                    </td>
                                                    <td className="p-0.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateAiChoice(day, !isAiChoice)}
                                                            className={`p-1 rounded transition-all ${
                                                                isAiChoice
                                                                    ? 'bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 ring-1 ring-violet-300 dark:ring-violet-500/40'
                                                                    : 'text-slate-300 dark:text-slate-700 hover:text-slate-400 dark:hover:text-slate-600'
                                                            }`}
                                                        >
                                                            <Sparkle size={12} />
                                                        </button>
                                                    </td>
                                                    {activeSports.swimming && (
                                                        <td className="p-0.5">
                                                            {isAiChoice ? (
                                                                <div className="w-full h-9 flex items-center justify-center">
                                                                    <span className="text-[9px] text-violet-400 dark:text-violet-500 font-medium">auto</span>
                                                                </div>
                                                            ) : (
                                                                <DurationInput
                                                                    value={slot.swimming}
                                                                    onChange={val => updateSlot(day, 'swimming', val)}
                                                                    placeholder="-"
                                                                    className="focus:text-cyan-400 focus:ring-cyan-500/50"
                                                                />
                                                            )}
                                                        </td>
                                                    )}
                                                    {activeSports.cycling && (
                                                        <td className="p-0.5">
                                                            {isAiChoice ? (
                                                                <div className="w-full h-9 flex items-center justify-center">
                                                                    <span className="text-[9px] text-violet-400 dark:text-violet-500 font-medium">auto</span>
                                                                </div>
                                                            ) : (
                                                                <DurationInput
                                                                    value={slot.cycling}
                                                                    onChange={val => updateSlot(day, 'cycling', val)}
                                                                    placeholder="-"
                                                                    className="focus:text-orange-400 focus:ring-orange-500/50"
                                                                />
                                                            )}
                                                        </td>
                                                    )}
                                                    {activeSports.running && (
                                                        <td className="p-0.5">
                                                            {isAiChoice ? (
                                                                <div className="w-full h-9 flex items-center justify-center">
                                                                    <span className="text-[9px] text-violet-400 dark:text-violet-500 font-medium">auto</span>
                                                                </div>
                                                            ) : (
                                                                <DurationInput
                                                                    value={slot.running}
                                                                    onChange={val => updateSlot(day, 'running', val)}
                                                                    placeholder="-"
                                                                    className="focus:text-emerald-400 focus:ring-emerald-500/50"
                                                                />
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="p-0.5">
                                                        <input
                                                            type="text"
                                                            value={slot.comment || ''}
                                                            onChange={e => updateDayComment(day, e.target.value)}
                                                            placeholder={isAiChoice ? "vacances..." : "note..."}
                                                            className="w-full min-w-[70px] bg-transparent border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-1 focus:ring-slate-400/30 transition-colors"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div className="flex items-center justify-between mt-1">
                                    <div className="flex items-center gap-1 text-[9px] text-violet-500 dark:text-violet-400/70 italic">
                                        <Sparkle size={8} />
                                        <span>= IA choisit</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 dark:text-slate-600 italic">
                                        &quot;1h30&quot;, &quot;90&quot;, &quot;1:30&quot; ou &quot;1.5&quot;
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
                        {confirmOverwrite && (
                            <div className="flex items-start gap-2 text-orange-600 dark:text-orange-300 text-xs bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg px-3 py-2 mb-3">
                                <AlertCircle size={12} className="shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
                                <span>
                                    <strong>{pendingCount} séance{pendingCount > 1 ? 's' : ''}</strong> sera{pendingCount > 1 ? 'ont' : ''} remplacée{pendingCount > 1 ? 's' : ''}.
                                </span>
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    if (confirmOverwrite) { setConfirmOverwrite(false); return; }
                                    setShowGenSheet(false);
                                }}
                                disabled={isGenerating}
                                className="flex-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            >
                                {confirmOverwrite ? 'Retour' : 'Annuler'}
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !weekStartDate || (!isLoadingContext && !weekContext)}
                                className={`flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                    confirmOverwrite ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'
                                }`}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Génération...
                                    </>
                                ) : confirmOverwrite ? (
                                    <>
                                        <AlertCircle size={14} />
                                        Confirmer
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={14} />
                                        Générer
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
