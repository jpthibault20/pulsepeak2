import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Zap } from 'lucide-react';
import { WeekStatsPopover } from './WeekStatsPopover';
import type { WeekStats } from '@/hooks/useWeekStats';

interface WeekSummaryCellProps {
    stats: WeekStats;
}

export function WeekSummaryCell({ stats }: WeekSummaryCellProps) {
    const [showPopover, setShowPopover] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // ✅ Détection de la position
    useEffect(() => {
        if (showPopover && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const spaceBelow = windowHeight - rect.bottom;

            // Si moins de 400px en dessous, ouvrir vers le haut
            setOpenUpward(spaceBelow < 400);
        }
    }, [showPopover]);

    const formatDuration = (totalMinutes: number) => {
        if (!totalMinutes) return '0h00';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return `${hours}h${minutes.toString().padStart(2, '0')}`;
    };

    const durationPercentage = 100 / stats.plannedDuration > 0
        ? Math.min((stats.actualDuration / stats.plannedDuration) * 100, 100)
        : 0;

    return (
        <div className="relative h-full w-full">
            <button
                ref={buttonRef}
                onClick={() => setShowPopover(!showPopover)}
                className="w-full h-full p-2 flex flex-col justify-between hover:bg-slate-800/40 transition-all duration-200 group text-left"
            >
                {/* Header Titre */}
                <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider group-hover:text-slate-300 transition-colors">
                        Bilan
                    </span>
                    <BarChart3 size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                </div>

                {/* Main Stats Block */}
                <div className="flex flex-col gap-3 py-1">
                    <div className="flex items-end gap-1.5">
                        <div className="flex items-baseline gap-1.5">
                            {/* Valeur Réalisée (Dominante) */}
                            <div className="text-xl font- text-white leading-none tracking-tight">
                                {Math.round(stats.completedTSS)}
                            </div>

                            {/* Valeur Prévue (Contexte) */}
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
                                className={`h-full rounded-full transition-all duration-500 ease-out ${durationPercentage >= 100
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                    : 'bg-linear-to-r from-blue-600 to-blue-400'
                                    }`}
                                style={{ width: `${durationPercentage}%` }}
                            />
                        </div>

                        {/* ✅ CHANGEMENT ICI : Affiche actualDuration partout */}
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
            </button>

            {/* ✅ POPUP avec ancrage conditionnel */}
            {showPopover && (
                <WeekStatsPopover
                    stats={stats}
                    onClose={() => setShowPopover(false)}
                    openUpward={openUpward}
                />
            )}
        </div>
    );
}
