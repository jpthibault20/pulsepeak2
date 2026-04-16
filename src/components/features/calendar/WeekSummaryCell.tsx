'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BarChart3, Bot, Plus, Sparkles, Zap, X, Loader2, AlertCircle, Target, Calendar } from 'lucide-react';
import { WeekGenerationProgressModal, type WeekGenProgressState } from './WeekGenerationProgressModal';
import { AvailabilityTable } from './AvailabilityTable';
import { WeekStatsPopover } from './WeekStatsPopover';
import type { WeekStats } from '@/hooks/useWeekStats';
import type { AvailabilitySlot } from '@/lib/data/type';
import { getWeekContextForDate, generateWeekWorkoutsFromDate, getWeekPendingCount, type WeekContext } from '@/app/actions/schedule';
import { formatDateKey } from '@/lib/utils';
import { FeatureGate } from '@/components/features/billing/FeatureGate';

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

const WEEK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    Load: { label: 'Charge', color: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20' },
    Recovery: { label: 'Récupération', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' },
    Taper: { label: 'Affûtage', color: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' },
};

interface WeekSummaryCellProps {
    stats: WeekStats;
    weekDates: (Date | null)[];
    profileAvailability: { [key: string]: AvailabilitySlot };
    activeSports: { swimming: boolean; cycling: boolean; running: boolean };
    onRefresh: () => void;
    onOpenGenModal: () => void;
}

export function WeekSummaryCell({
    stats,
    weekDates,
    profileAvailability,
    activeSports,
    onRefresh,
    onOpenGenModal,
}: WeekSummaryCellProps) {
    const [showPopover, setShowPopover] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);

    // Modal state
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

    // Monday of this week (weekDates[0] = Lundi dans la grille ISO)
    const weekStartDate = (() => {
        const firstNonNull = weekDates.find(d => d !== null);
        if (!firstNonNull) return null;
        const idx = weekDates.indexOf(firstNonNull);
        const monday = new Date(firstNonNull);
        monday.setDate(monday.getDate() - idx);
        return formatDateKey(monday);
    })();

    // Calcul du lundi de la semaine courante (local)
    const thisMonday = (() => {
        const today = new Date();
        const day = today.getDay();
        const daysToMon = day === 0 ? -6 : 1 - day;
        const mon = new Date(today);
        mon.setDate(today.getDate() + daysToMon);
        mon.setHours(0, 0, 0, 0);
        return mon;
    })();

    const weekStartLocal = weekStartDate ? new Date(weekStartDate + 'T00:00:00') : null;
    const isPastWeek = weekStartLocal ? weekStartLocal < thisMonday : false;
    const weeksAhead = weekStartLocal
        ? Math.round((weekStartLocal.getTime() - thisMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
        : 0;
    const isFarFuture = weeksAhead >= 2;

    const handleAIClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
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
        setShowAIModal(true);

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

        // Si des séances pending existent et que l'utilisateur n'a pas encore confirmé
        if (pendingCount > 0 && !confirmOverwrite) {
            setConfirmOverwrite(true);
            return;
        }

        const weekLabel = `Semaine du ${new Date(weekStartDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;

        setIsGenerating(true);
        setError(null);
        setShowAIModal(false);
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

    useEffect(() => {
        if (showPopover && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setOpenUpward(window.innerHeight - rect.bottom < 400);
        }
    }, [showPopover]);

    const formatDuration = (totalMinutes: number) => {
        if (!totalMinutes) return '0h00';
        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        return `${h}h${m.toString().padStart(2, '0')}`;
    };

    const durationPercentage = stats.plannedDuration === 0
        ? (stats.actualDuration > 0 ? 100 : 0)
        : Math.min((stats.actualDuration / stats.plannedDuration) * 100, 100);

    return (
        <div className="relative h-full w-full">
            {/* ─── Cellule cliquable ─── */}
            <div
                ref={buttonRef}
                onClick={() => setShowPopover(p => !p)}
                className="group relative w-full h-full p-2 flex flex-col justify-between hover:bg-slate-100/40 dark:hover:bg-slate-800/40 transition-all duration-300 cursor-pointer overflow-hidden rounded-lg"
            >
                {/* Header */}
                <div className="relative z-20 flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                        Bilan
                    </span>
                    <BarChart3 size={14} className="text-slate-500 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </div>

                {/* Overlay IA au hover */}
                <div className="absolute inset-0 top-6 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100">
                    {isPastWeek ? (
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 cursor-not-allowed">
                                <Plus size={24} strokeWidth={3} />
                            </div>
                            <div className="text-[9px] font-bold text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 backdrop-blur-md">
                                Semaine passée
                            </div>
                        </div>
                    ) : (
                        <FeatureGate feature="generate-plan" mode="modal" label="Générer un plan IA">
                            <button
                                onClick={handleAIClick}
                                className="flex flex-col items-center gap-1 group/btn"
                            >
                                <div className="w-10 h-10 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] flex items-center justify-center text-white group-hover/btn:scale-110 transition-transform duration-200">
                                    <Plus size={24} strokeWidth={3} />
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-bold text-blue-700 dark:text-blue-200 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/30 backdrop-blur-md">
                                    <Sparkles size={8} />
                                    <span>Générer IA</span>
                                </div>
                            </button>
                        </FeatureGate>
                    )}
                </div>

                {/* Données (floutées au hover) */}
                <div className="flex flex-col justify-between grow transition-all duration-300 group-hover:blur-[3px] group-hover:opacity-20 group-hover:scale-95 origin-center">
                    <div className="flex flex-col gap-3 py-1">
                        <div className="flex items-end gap-1.5">
                            <div className="flex items-baseline gap-1.5">
                                <div className="text-xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                                    {Math.round(stats.completedTSS)}
                                </div>
                                <div className="text-sm font-medium text-slate-500 leading-none">
                                    <span className="opacity-50 mr-1">/</span>
                                    {Math.round(stats.plannedTSS)}
                                </div>
                            </div>
                            <div className="text-[10px] font-medium text-slate-500 flex items-center gap-0.5">
                                <Zap size={10} className="text-yellow-500/70" /> TSS
                            </div>
                        </div>

                        <div className="w-full space-y-1.5">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-300/50 dark:border-slate-700/50">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${durationPercentage >= 100
                                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                        : 'bg-linear-to-r from-blue-600 to-blue-400'
                                        }`}
                                    style={{ width: `${durationPercentage}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px] leading-none">
                                <span className={`font-semibold ${stats.actualDuration > 0 ? 'text-blue-700 dark:text-blue-200' : 'text-slate-500'}`}>
                                    {formatDuration(stats.actualDuration)}
                                </span>
                                <span className="text-slate-500 dark:text-slate-600 font-medium">
                                    {formatDuration(stats.plannedDuration)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-2 flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-600 font-medium border-t border-slate-200/50 dark:border-slate-800/50 w-full">
                        <div className={`w-1.5 h-1.5 rounded-full ${stats.completed >= stats.total ? 'bg-emerald-500/50' : 'bg-slate-300 dark:bg-slate-700'}`} />
                        {stats.completed}/{stats.total} séances
                    </div>
                </div>
            </div>

            {/* Popover bilan */}
            {showPopover && (
                <WeekStatsPopover
                    stats={stats}
                    onClose={() => setShowPopover(false)}
                    openUpward={openUpward}
                />
            )}

            {/* ─── MODAL GÉNÉRATION IA ─── */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => !isGenerating && setShowAIModal(false)} />

                    <div
                        className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header modal */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-linear-to-r from-blue-50 dark:from-blue-950/30 to-white dark:to-slate-900 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 dark:bg-blue-500/20 p-2 rounded-lg">
                                    <Bot size={20} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-slate-900 dark:text-white font-bold text-base">Générer la semaine</h3>
                                    {weekStartDate && (
                                        <p className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1 mt-0.5">
                                            <Calendar size={10} />
                                            Semaine du{' '}
                                            {new Date(weekStartDate + 'T00:00:00').toLocaleDateString('fr-FR', {
                                                day: 'numeric',
                                                month: 'long',
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAIModal(false)}
                                disabled={isGenerating}
                                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body scrollable */}
                        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                            {/* Contexte bloc */}
                            {isLoadingContext ? (
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm py-1">
                                    <Loader2 size={14} className="animate-spin" />
                                    Chargement du contexte...
                                </div>
                            ) : weekContext ? (
                                <div className="bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <Target size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                            Contexte du plan
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${WEEK_TYPE_LABELS[weekContext.weekType]?.color ?? 'text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}>
                                            {WEEK_TYPE_LABELS[weekContext.weekType]?.label ?? weekContext.weekType}
                                        </span>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700">
                                            Semaine {weekContext.weekNumber}/{weekContext.blockWeekCount}
                                        </span>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20">
                                            {weekContext.targetTSS} TSS cible
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 font-medium leading-snug">
                                        <span className="text-slate-500 text-xs mr-1">Thème :</span>
                                        &ldquo;{weekContext.blockTheme}&rdquo;
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3">
                                    <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm font-medium">
                                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                                        <span>Impossible de générer la semaine : aucun bloc ni plan actif pour cette période.</span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                        La génération de semaine nécessite un plan avec des blocs d&apos;entraînement. Commencez par calculer un plan.
                                    </p>
                                    <button
                                        onClick={() => { setShowAIModal(false); onOpenGenModal(); }}
                                        className="self-start flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors"
                                    >
                                        <Plus size={12} />
                                        Calculer un nouveau plan
                                    </button>
                                </div>
                            )}

                            {/* Avertissement semaine trop éloignée */}
                            {isFarFuture && (
                                <div className="flex items-start gap-2 text-yellow-600 dark:text-yellow-400 text-xs bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg px-3 py-2.5">
                                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                    <span>
                                        Génération <strong>+{weeksAhead} semaines</strong> en avance — la précision sera moindre car les paramètres de forme et de fatigue ne sont pas encore connus.
                                    </span>
                                </div>
                            )}

                            {/* Commentaire */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                    Commentaire
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder="Ex : semaine chargée au travail, jambes lourdes, légère douleur au genou..."
                                    rows={2}
                                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:border-blue-400/60 dark:focus:border-blue-500/60 focus:ring-1 focus:ring-blue-400/30 dark:focus:ring-blue-500/30 transition-colors"
                                />
                            </div>

                            {/* Disponibilités */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                    Disponibilités
                                </label>
                                <AvailabilityTable
                                    availability={availability}
                                    activeSports={activeSports}
                                    onSlotChange={updateSlot}
                                    onCommentChange={updateDayComment}
                                    onAiChoiceChange={updateAiChoice}
                                />

                            </div>

                            {/* Erreur */}
                            {error && (
                                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2.5">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 shrink-0">
                            {confirmOverwrite && (
                                <div className="flex items-start gap-2 text-orange-600 dark:text-orange-300 text-xs bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-lg px-3 py-2.5 mb-3">
                                    <AlertCircle size={13} className="shrink-0 mt-0.5 text-orange-600 dark:text-orange-400" />
                                    <span>
                                        <strong>{pendingCount} séance{pendingCount > 1 ? 's' : ''} planifiée{pendingCount > 1 ? 's' : ''}</strong> sera{pendingCount > 1 ? 'ont' : ''} remplacée{pendingCount > 1 ? 's' : ''}.
                                        Les séances complétées (Strava, manuel) sont conservées.
                                        Confirmer ?
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        if (confirmOverwrite) { setConfirmOverwrite(false); return; }
                                        setShowAIModal(false);
                                    }}
                                    disabled={isGenerating}
                                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm transition-colors px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    {confirmOverwrite ? 'Retour' : 'Annuler'}
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !weekStartDate || (!isLoadingContext && !weekContext)}
                                    className={`flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${confirmOverwrite ? 'bg-orange-600 hover:bg-orange-500' : 'bg-blue-600 hover:bg-blue-500'
                                        }`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Génération en cours...
                                        </>
                                    ) : confirmOverwrite ? (
                                        <>
                                            <AlertCircle size={14} />
                                            Confirmer et remplacer
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
            )}

            {/* ─── PROGRESS MODAL GÉNÉRATION SEMAINE ─── */}
            <WeekGenerationProgressModal
                state={weekGenProgress}
                onMinimize={() => setWeekGenProgress(prev => ({ ...prev, minimized: true }))}
                onRestore={() => setWeekGenProgress(prev => ({ ...prev, minimized: false }))}
                onClose={() => setWeekGenProgress(prev => ({ ...prev, active: false }))}
            />
        </div>
    );
}
