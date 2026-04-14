'use client';

import React, { useEffect, useRef, useState } from 'react'; // useRef gardé pour intervalRef
import { Zap, Check, Loader2, Minus, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenProgressState {
    active: boolean;
    minimized: boolean;
    done: boolean;
    startedAt: number;    // Date.now()
    profileInfo: {
        firstName: string;
        experience: string | null;
        currentCTL: number;
        sports: string;
    };
}

interface GenerationProgressModalProps {
    state: GenProgressState;
    onMinimize: () => void;
    onRestore: () => void;
}

// ─── Stages config ────────────────────────────────────────────────────────────

const STAGES = [
    { label: 'Analyse du profil athlète', progressAt: 10 },
    { label: 'Conception des blocs d\'entraînement', progressAt: 42 },
    { label: 'Calcul de la progression de charge', progressAt: 60 },
    { label: 'Génération des séances', progressAt: 88 },
    { label: 'Sauvegarde du plan', progressAt: 96 },
];

const LEVEL_COLORS: Record<string, string> = {
    'Débutant': 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-400/10',
    'Intermédiaire': 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-400/10',
    'Avancé': 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-400/10',
};

// ─── Progress animation hook ──────────────────────────────────────────────────

const TOTAL_MS = 20_000; // durée de l'animation (couvre la génération)
const MAX_AUTO = 93;     // plafond automatique — le 100% est déclenché par done=true

function useAnimatedProgress(active: boolean, done: boolean, startedAt: number) {
    const [progress, setProgress] = useState(() => done ? 100 : 0);
    const [prevActive, setPrevActive] = useState(active);
    const [prevDone, setPrevDone] = useState(done);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset à 0 quand active passe de true à false
    if (prevActive && !active) {
        setProgress(0);
        setPrevActive(active);
    } else if (prevActive !== active) {
        setPrevActive(active);
    }

    // Saute à 100 dès que done passe à true
    if (!prevDone && done) {
        setProgress(100);
        setPrevDone(done);
    } else if (prevDone !== done) {
        setPrevDone(done);
    }

    // Lance l'animation quand active est true
    useEffect(() => {
        if (!active || done) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            const linear = Math.min(elapsed / TOTAL_MS, 1);
            const eased = 1 - Math.pow(1 - linear, 2.2); // ease-out
            const next = Math.min(eased * MAX_AUTO, MAX_AUTO);
            setProgress(next);

            if (elapsed >= TOTAL_MS) {
                clearInterval(intervalRef.current!);
            }
        }, 80); // ~12 fps — fluide sans surcharger React

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [active, done, startedAt]);

    return progress;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GenerationProgressModal({
    state,
    onMinimize,
    onRestore,
}: GenerationProgressModalProps) {
    const progress = useAnimatedProgress(state.active, state.done, state.startedAt);
    const stageIndex = state.done
        ? STAGES.length - 1
        : STAGES.findLastIndex(s => progress >= s.progressAt);
    const activeIdx = Math.max(0, stageIndex);

    const levelStyle = (state.profileInfo.experience ? LEVEL_COLORS[state.profileInfo.experience] : null) ?? 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-400/10';

    // ── Mini banner ──────────────────────────────────────────────────────────
    if (state.minimized && state.active) {
        return (
            <button
                onClick={onRestore}
                className="fixed top-20 right-3 z-50 flex items-center gap-2.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-full shadow-lg text-sm font-medium text-slate-900 dark:text-white animate-in slide-in-from-top-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                {state.done ? (
                    <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                    <Loader2 size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
                )}
                <span>{state.done ? 'Plan créé !' : 'Génération…'}</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold tabular-nums">
                    {Math.round(progress)}%
                </span>
                <ChevronUp size={14} className="text-slate-500" />
            </button>
        );
    }

    if (!state.active) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-2xl shadow-slate-300/50 dark:shadow-black/50 overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="relative px-5 pt-5 pb-4 bg-linear-to-br from-blue-50 dark:from-blue-950/60 to-white dark:to-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shrink-0">
                                <Zap size={18} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                    {state.done ? 'Plan créé avec succès !' : 'Génération en cours…'}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {state.done
                                        ? 'Votre plan est prêt'
                                        : 'Veuillez patienter ~15 secondes'}
                                </p>
                            </div>
                        </div>
                        {!state.done && (
                            <button
                                onClick={onMinimize}
                                title="Réduire"
                                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                            >
                                <Minus size={16} />
                            </button>
                        )}
                    </div>

                    {/* Athlete pill */}
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {state.profileInfo.firstName}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${levelStyle}`}>
                            {state.profileInfo.experience}
                        </span>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">CTL {state.profileInfo.currentCTL}</span>
                        <span className="text-xs text-slate-500">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{state.profileInfo.sports}</span>
                    </div>
                </div>

                {/* ── Progress bar ── */}
                <div className="px-5 pt-5 pb-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {state.done ? 'Terminé' : STAGES[activeIdx]?.label ?? '…'}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${state.done
                                ? 'bg-emerald-500'
                                : 'bg-linear-to-r from-blue-600 to-blue-400'
                                }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* ── Stages list ── */}
                <div className="px-5 pt-3 pb-5 space-y-2.5">
                    {STAGES.map((stage, i) => {
                        const isDone = state.done || progress > stage.progressAt + 5 || i < activeIdx;
                        const isActive = !state.done && i === activeIdx && !isDone;
                        const isPending = !isDone && !isActive;

                        return (
                            <div key={i} className="flex items-center gap-3">
                                <div className={`
                                    w-5 h-5 rounded-full flex items-center justify-center shrink-0
                                    ${isDone ? 'bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/40' : ''}
                                    ${isActive ? 'bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/40' : ''}
                                    ${isPending ? 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700' : ''}
                                `}>
                                    {isDone && <Check size={11} className="text-emerald-600 dark:text-emerald-400" />}
                                    {isActive && <Loader2 size={11} className="text-blue-600 dark:text-blue-400 animate-spin" />}
                                </div>
                                <span className={`text-sm ${isDone ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-400 dark:decoration-slate-600' :
                                    isActive ? 'text-slate-900 dark:text-white font-medium' :
                                        'text-slate-500 dark:text-slate-600'
                                    }`}>
                                    {stage.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
