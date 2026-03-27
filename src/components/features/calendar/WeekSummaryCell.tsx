'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BarChart3, Bot, Plus, Sparkles, Zap, X, Loader2, AlertCircle, Target, Calendar } from 'lucide-react';
import { WeekStatsPopover } from './WeekStatsPopover';
import type { WeekStats } from '@/hooks/useWeekStats';
import type { AvailabilitySlot } from '@/lib/data/type';
import { getWeekContextForDate, generateWeekWorkoutsFromDate, type WeekContext } from '@/app/actions/schedule';

const DAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const;

const WEEK_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    Load:     { label: 'Charge',       color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
    Recovery: { label: 'Récupération', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    Taper:    { label: 'Affûtage',     color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
};

const SPORT_LABELS: Record<string, string> = {
    cycling:  'Vélo',
    running:  'Course',
    swimming: 'Natation',
};

interface WeekSummaryCellProps {
    stats: WeekStats;
    weekDates: (Date | null)[];
    profileAvailability: { [key: string]: AvailabilitySlot };
    activeSports: { swimming: boolean; cycling: boolean; running: boolean };
    onRefresh: () => void;
}

export function WeekSummaryCell({
    stats,
    weekDates,
    profileAvailability,
    activeSports,
    onRefresh,
}: WeekSummaryCellProps) {
    const [showPopover, setShowPopover]      = useState(false);
    const [openUpward, setOpenUpward]        = useState(false);
    const [showAIModal, setShowAIModal]      = useState(false);
    const buttonRef = useRef<HTMLDivElement>(null);

    // Modal state
    const [comment, setComment]                  = useState('');
    const [availability, setAvailability]        = useState<{ [key: string]: AvailabilitySlot }>({});
    const [weekContext, setWeekContext]           = useState<WeekContext>(null);
    const [isLoadingContext, setIsLoadingContext] = useState(false);
    const [isGenerating, setIsGenerating]        = useState(false);
    const [error, setError]                      = useState<string | null>(null);

    // Sports actifs sous forme de liste
    const activeSportsList = (
        Object.entries(activeSports) as [keyof typeof activeSports, boolean][]
    ).filter(([, v]) => v).map(([k]) => k);

    // Monday of this week (weekDates[0] = Lundi dans la grille ISO)
    const weekStartDate = (() => {
        const firstNonNull = weekDates.find(d => d !== null);
        if (!firstNonNull) return null;
        const idx = weekDates.indexOf(firstNonNull);
        const monday = new Date(firstNonNull);
        monday.setDate(monday.getDate() - idx);
        return monday.toISOString().split('T')[0];
    })();

    const handleAIClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!weekStartDate) return;

        const defaultAvail: { [key: string]: AvailabilitySlot } = {};
        DAYS_FR.forEach(day => {
            defaultAvail[day] = profileAvailability[day]
                ?? { swimming: 0, cycling: 0, running: 0, comment: '' };
        });
        setAvailability(defaultAvail);
        setComment('');
        setError(null);
        setWeekContext(null);
        setShowAIModal(true);

        setIsLoadingContext(true);
        getWeekContextForDate(weekStartDate)
            .then(ctx => setWeekContext(ctx))
            .catch(() => setWeekContext(null))
            .finally(() => setIsLoadingContext(false));
    }, [weekStartDate, profileAvailability]);

    const handleGenerate = async () => {
        if (!weekStartDate) return;
        setIsGenerating(true);
        setError(null);
        try {
            await generateWeekWorkoutsFromDate(weekStartDate, comment || null, availability);
            setShowAIModal(false);
            onRefresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erreur lors de la génération.');
        } finally {
            setIsGenerating(false);
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
                className="group relative w-full h-full p-2 flex flex-col justify-between hover:bg-slate-800/40 transition-all duration-300 cursor-pointer overflow-hidden rounded-lg"
            >
                {/* Header */}
                <div className="relative z-20 flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider group-hover:text-slate-300 transition-colors">
                        Bilan
                    </span>
                    <BarChart3 size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                </div>

                {/* Overlay IA au hover */}
                <div className="absolute inset-0 top-6 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-95 group-hover:scale-100">
                    <button
                        onClick={handleAIClick}
                        className="flex flex-col items-center gap-1 group/btn"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.5)] flex items-center justify-center text-white group-hover/btn:scale-110 transition-transform duration-200">
                            <Plus size={24} strokeWidth={3} />
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-bold text-blue-200 bg-slate-900/80 px-2 py-0.5 rounded-full border border-blue-500/30 backdrop-blur-md">
                            <Sparkles size={8} />
                            <span>Générer IA</span>
                        </div>
                    </button>
                </div>

                {/* Données (floutées au hover) */}
                <div className="flex flex-col justify-between grow transition-all duration-300 group-hover:blur-[3px] group-hover:opacity-20 group-hover:scale-95 origin-center">
                    <div className="flex flex-col gap-3 py-1">
                        <div className="flex items-end gap-1.5">
                            <div className="flex items-baseline gap-1.5">
                                <div className="text-xl font-bold text-white leading-none tracking-tight">
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
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700/50">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                                        durationPercentage >= 100
                                            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                            : 'bg-gradient-to-r from-blue-600 to-blue-400'
                                    }`}
                                    style={{ width: `${durationPercentage}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[10px] leading-none">
                                <span className={`font-semibold ${stats.actualDuration > 0 ? 'text-blue-200' : 'text-slate-500'}`}>
                                    {formatDuration(stats.actualDuration)}
                                </span>
                                <span className="text-slate-600 font-medium">
                                    {formatDuration(stats.plannedDuration)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-2 flex items-center gap-1 text-[9px] text-slate-600 font-medium border-t border-slate-800/50 w-full">
                        <div className={`w-1.5 h-1.5 rounded-full ${stats.completed >= stats.total ? 'bg-emerald-500/50' : 'bg-slate-700'}`} />
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
                        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header modal */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-gradient-to-r from-blue-950/30 to-slate-900 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-500/20 p-2 rounded-lg">
                                    <Bot size={20} className="text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-base">Générer la semaine</h3>
                                    {weekStartDate && (
                                        <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5">
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
                                className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body scrollable */}
                        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                            {/* Contexte bloc */}
                            {isLoadingContext ? (
                                <div className="flex items-center gap-2 text-slate-400 text-sm py-1">
                                    <Loader2 size={14} className="animate-spin" />
                                    Chargement du contexte...
                                </div>
                            ) : weekContext ? (
                                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-2.5">
                                    <div className="flex items-center gap-2">
                                        <Target size={14} className="text-blue-400 shrink-0" />
                                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                            Contexte du plan
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${WEEK_TYPE_LABELS[weekContext.weekType]?.color ?? 'text-slate-400 bg-slate-700 border-slate-600'}`}>
                                            {WEEK_TYPE_LABELS[weekContext.weekType]?.label ?? weekContext.weekType}
                                        </span>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border text-slate-400 bg-slate-800 border-slate-700">
                                            Semaine {weekContext.weekNumber}/{weekContext.blockWeekCount}
                                        </span>
                                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border text-yellow-400 bg-yellow-500/10 border-yellow-500/20">
                                            {weekContext.targetTSS} TSS cible
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-200 font-medium leading-snug">
                                        <span className="text-slate-500 text-xs mr-1">Thème :</span>
                                        &ldquo;{weekContext.blockTheme}&rdquo;
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                                    <AlertCircle size={13} className="shrink-0 mt-0.5" />
                                    Aucun plan actif trouvé pour cette semaine. La génération utilisera votre profil par défaut.
                                </div>
                            )}

                            {/* Commentaire */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Commentaire
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder="Ex : semaine chargée au travail, jambes lourdes, légère douleur au genou..."
                                    rows={2}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 resize-none focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                                />
                            </div>

                            {/* Disponibilités */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Disponibilités
                                    <span className="text-slate-500 normal-case font-normal ml-1">(minutes par sport)</span>
                                </label>

                                <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden text-xs">
                                    {/* Header */}
                                    <div className="flex items-center border-b border-slate-700/50 bg-slate-800/60">
                                        <div className="w-24 shrink-0 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            Jour
                                        </div>
                                        {activeSportsList.map(sport => (
                                            <div key={sport} className="flex-1 px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                                                {SPORT_LABELS[sport]}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Rows */}
                                    {DAYS_FR.map((day, i) => {
                                        const slot = availability[day] ?? { swimming: 0, cycling: 0, running: 0, comment: '' };
                                        const hasAvail = activeSportsList.some(s => (slot[s as keyof typeof slot] as number) > 0);
                                        return (
                                            <div
                                                key={day}
                                                className={`flex items-center border-b border-slate-800/40 last:border-0 transition-colors ${hasAvail ? 'bg-slate-800/20' : ''}`}
                                            >
                                                <div className={`w-24 shrink-0 px-3 py-1.5 font-medium ${hasAvail ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    {day.slice(0, 3)}.
                                                </div>
                                                {activeSportsList.map(sport => (
                                                    <div key={sport} className="flex-1 px-2 py-1">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            step={15}
                                                            value={(slot[sport as keyof typeof slot] as number) ?? 0}
                                                            onChange={e =>
                                                                updateSlot(day, sport as keyof Omit<AvailabilitySlot, 'comment'>, Number(e.target.value))
                                                            }
                                                            className="w-full bg-slate-700/50 border border-slate-600/50 rounded px-1.5 py-1 text-xs text-slate-200 text-center focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-colors"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Erreur */}
                            {error && (
                                <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-950/30 shrink-0">
                            <button
                                onClick={() => setShowAIModal(false)}
                                disabled={isGenerating}
                                className="text-slate-400 hover:text-white text-sm transition-colors px-3 py-2 rounded-lg hover:bg-slate-800"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !weekStartDate}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 size={14} className="animate-spin" />
                                        Génération en cours...
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
            )}
        </div>
    );
}
