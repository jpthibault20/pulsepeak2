'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Minus, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressStage {
    label: string;
    progressAt: number;
}

export interface ProgressState {
    active:    boolean;
    minimized: boolean;
    done:      boolean;
    error:     string | null;
    startedAt: number;
}

export interface ProgressModalConfig {
    icon:             React.ReactNode;
    label:            string;
    titleLoading:     string;
    titleDone:        string;
    titleError:       string;
    subtitleLoading:  string;
    subtitleDone:     string;
    miniLabelLoading: string;
    miniLabelDone:    string;
    stages:           ProgressStage[];
    durationMs:       number;
}

interface ProgressModalProps {
    state:      ProgressState;
    config:     ProgressModalConfig;
    onMinimize: () => void;
    onRestore:  () => void;
    onClose:    () => void;
}

// ─── Progress animation hook ──────────────────────────────────────────────────

const MAX_AUTO = 93;

function useAnimatedProgress(active: boolean, done: boolean, startedAt: number, durationMs: number) {
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!active) { setProgress(0); return; }
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startedAt;
            const linear  = Math.min(elapsed / durationMs, 1);
            const eased   = 1 - Math.pow(1 - linear, 2.2);
            const next    = Math.min(eased * MAX_AUTO, MAX_AUTO);
            setProgress(next);
            if (elapsed >= durationMs) clearInterval(intervalRef.current!);
        }, 80);

        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [active, startedAt, durationMs]);

    useEffect(() => {
        if (done) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setProgress(100);
        }
    }, [done]);

    return progress;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProgressModal({ state, config, onMinimize, onRestore, onClose }: ProgressModalProps) {
    const progress   = useAnimatedProgress(state.active, state.done, state.startedAt, config.durationMs);
    const stageIndex = state.done
        ? config.stages.length - 1
        : config.stages.findLastIndex(s => progress >= s.progressAt);
    const activeIdx  = Math.max(0, stageIndex);

    // Auto-close after done
    useEffect(() => {
        if (state.done && !state.error) {
            const t = setTimeout(onClose, 1200);
            return () => clearTimeout(t);
        }
    }, [state.done, state.error, onClose]);

    // ── Mini banner ──
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
                <span>{state.done ? config.miniLabelDone : config.miniLabelLoading}</span>
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
                <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-blue-50 dark:from-blue-950/60 to-white dark:to-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                {config.icon}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                                    {state.error ? config.titleError : state.done ? config.titleDone : config.titleLoading}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {state.error ? state.error : state.done ? config.subtitleDone : config.subtitleLoading}
                                </p>
                            </div>
                        </div>
                        {!state.done && !state.error && (
                            <button
                                onClick={onMinimize}
                                title="Réduire"
                                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
                            >
                                <Minus size={16} />
                            </button>
                        )}
                    </div>

                    {/* Label pill */}
                    {config.label && (
                        <div className="flex items-center gap-2 mt-4">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {config.label}
                            </span>
                        </div>
                    )}
                </div>

                {/* ── Progress bar ── */}
                <div className="px-5 pt-5 pb-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            {state.error ? 'Interrompu' : state.done ? 'Terminé' : config.stages[activeIdx]?.label ?? '…'}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-[width] duration-200 ${
                                state.error
                                    ? 'bg-red-500'
                                    : state.done
                                        ? 'bg-emerald-500'
                                        : 'bg-gradient-to-r from-blue-600 to-blue-400'
                            }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* ── Stages list ── */}
                <div className="px-5 pt-3 pb-5 space-y-2.5">
                    {config.stages.map((stage, i) => {
                        const isDone    = state.done || progress > stage.progressAt + 5 || i < activeIdx;
                        const isActive  = !state.done && !state.error && i === activeIdx && !isDone;
                        const isPending = !isDone && !isActive;

                        return (
                            <div key={i} className="flex items-center gap-3">
                                <div className={`
                                    w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                                    ${isDone    ? 'bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/40' : ''}
                                    ${isActive  ? 'bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/40' : ''}
                                    ${isPending ? 'bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700' : ''}
                                `}>
                                    {isDone && <Check size={11} className="text-emerald-600 dark:text-emerald-400" />}
                                    {isActive && <Loader2 size={11} className="text-blue-600 dark:text-blue-400 animate-spin" />}
                                </div>
                                <span className={`text-sm ${
                                    isDone    ? 'text-slate-500 dark:text-slate-400 line-through decoration-slate-400 dark:decoration-slate-600' :
                                    isActive  ? 'text-slate-900 dark:text-white font-medium' :
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
